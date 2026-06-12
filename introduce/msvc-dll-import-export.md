# MSVC 动态库导入导出机制详解

## 前言：为什么需要动态库？

在开始讨论 MSVC 的导入导出机制之前，先回答一个根本问题：**为什么要用动态库？**

```
静态库 (.lib)                      动态库 (.dll)
─────────────                      ─────────────
编译时嵌入到 .exe 中                运行时由 OS 加载器加载
每个 .exe 都包含一份副本            多个进程共享同一份物理内存
更新库 → 重新链接整个 .exe         更新库 → 替换 .dll 文件即可
.exe 体积大                        .exe 体积小
无加载失败风险                      可能因 .dll 缺失启动失败
```

动态库的核心价值在于**代码复用和运行时替换**。Windows 自身就是建立在动态库之上的——kernel32.dll、user32.dll、ntdll.dll 构成了 Windows 的 API 表层。

---

## 一、整体架构：编译-链接-运行三阶段

理解动态库机制，首先要看清整个流程中每个阶段在做什么：

```
源文件阶段                        链接阶段                           运行阶段
─────────                        ─────────                         ────────

foo.cpp  ──编译──▶ foo.obj       foo.obj ──链接──▶ foo.dll          app.exe 启动
         (COFF)          .lib    bar.obj             foo.lib         OS 加载器:
                                        (导入库)                     
bar.cpp  ──编译──▶ bar.obj                │                        1. 读 app.exe 的导入表
                                           │                       2. 找到 foo.dll
app.cpp  ──编译──▶ app.obj                │                       3. 加载 foo.dll 到内存
                                           │                       4. 解析导出符号
                          ┌────────────────┘                       5. 填充 IAT
                          ▼                                        6. 跳转到 app.exe 入口
                     linker.exe
                         │
                ┌────────┼────────┐
                ▼        ▼        ▼
            app.exe  foo.dll  foo.lib
                          (导入库，给
                           其他程序用)
```

### 1.1 三种 .lib 文件的本质区别

这是最容易被混淆的地方——MSVC 工具链中 `.lib` 文件承担了两种完全不同的角色：

```
╔══════════════════╦══════════════════════╦══════════════════════╗
║                  ║   静态库 .lib         ║   导入库 .lib         ║
╠══════════════════╬══════════════════════╬══════════════════════╣
║ 包含内容          ║ 完整的 .obj 文件的集合  ║ 只有符号→DLL映射表    ║
║ 文件大小          ║ 大（等于所有 .obj 之和）║ 小（KB 级别）         ║
║ 链接时机          ║ 编译时链接             ║ 编译时链接            ║
║ 代码存在位置       ║ 最终嵌入 .exe/.dll    ║ 指向外部 .dll        ║
║ 运行时是否需要文件  ║ 不需要                ║ 需要对应的 .dll      ║
║ 生成命令           ║ lib /OUT:foo.lib *.obj║ link /DLL 自动生成  ║
╚══════════════════╩══════════════════════╩══════════════════════╝
```

**导入库的核心结构**：导入库中每个符号对应一条记录，告诉链接器：

```
符号名: "?foo@@YAHXZ"  →  来源DLL: bar.dll  →  在DLL中的序号/名称
```

链接器把这些信息写入最终 PE 文件的导入表（Import Table），OS 加载器在运行时读取导入表来完成实际的 DLL 加载和符号绑定。

---

## 二、导出端：__declspec(dllexport)

### 2.1 基本用法

```cpp
// foo.h
#ifdef BUILDING_FOO_DLL
  #define FOO_API __declspec(dllexport)
#else
  #define FOO_API __declspec(dllimport)
#endif

FOO_API int add(int a, int b);          // 导出函数
FOO_API extern int g_counter;           // 导出全局变量
FOO_API class Widget { /* ... */ };     // 导出整个类
```

```cpp
// foo.cpp —— 编译时需要定义 BUILDING_FOO_DLL
#define BUILDING_FOO_DLL
#include "foo.h"

FOO_API int add(int a, int b) {
    return a + b;
}
```

### 2.2 dllexport 在编译期做了什么

当你用 `__declspec(dllexport)` 标记一个符号时，编译器做了两件事：

```
编译器行为 (cl.exe)
═══════════════════════════════════════════════════

1. 在 .obj 中将符号标记为 "导出符号"
   → COFF 符号表中设置 IMAGE_SYM_CLASS_EXTERNAL + 导出属性

2. 自动为该符号生成一个 import thunk stub
   → 供同一 .dll 内部其他编译单元隐式链接时使用
   → 本质是一个间接跳转: jmp [__imp_?add@@YAHHH@Z]
```

### 2.3 链接阶段：导出表 (Export Table) 的生成

`link.exe /DLL` 收集所有 .obj 中标记为导出的符号，在 PE 文件中生成 **导出目录表 (Export Directory Table)**：

```
PE 文件结构中的导出表位置
═══════════════════════════════════════════════════

IMAGE_DOS_HEADER
    │
    └── e_lfanew ──▶ IMAGE_NT_HEADERS
                          │
                          └── OptionalHeader.DataDirectory[0]  ← 导出表
                                    │
                                    ▼
                          IMAGE_EXPORT_DIRECTORY
                          ┌──────────────────────────┐
                          │ Characteristics          │
                          │ TimeDateStamp            │
                          │ Name: "foo.dll"          │
                          │ Base: 1  (序号基数)       │
                          │ NumberOfFunctions: 3    │
                          │ NumberOfNames: 3        │
                          │ AddressOfFunctions ────▶│ [RVA_add, RVA_sub, RVA_mul]
                          │ AddressOfNames ────────▶│ ["add", "sub", "mul"]
                          │ AddressOfNameOrdinals ─▶│ [0, 1, 2]  (名字→序号映射)
                          └──────────────────────────┘
```

**导出表的工作原理——三种查找方式**：

```
方式一：按名字查找 (最常见)
  GetProcAddress(hDll, "add")
      1. 遍历 AddressOfNames，找到 "add" 的索引 i
      2. 查 AddressOfNameOrdinals[i] 得到序号 ord
      3. 查 AddressOfFunctions[ord] 得到 RVA

方式二：按序号查找 (效率更高)
  GetProcAddress(hDll, MAKEINTRESOURCE(1))
      1. 直接用序号查 AddressOfFunctions[序号 - Base]

方式三：内部链接时链接器查找
  linker 读取导入库 → 得到符号名/序号 → 写入 PE 导入表
```

### 2.4 .def 文件显式导出

除了 `__declspec(dllexport)`，还可以用 `.def` 文件控制导出：

```
; foo.def
LIBRARY   foo
EXPORTS
    add        @1          ; 序号 1
    sub        @2          ; 序号 2
    mul        @3  NONAME  ; 仅按序号导出，无名字
    div        @4  PRIVATE ; 仅供同团队使用，不出现在导入库中

; 编译命令: link /DLL /DEF:foo.def foo.obj
```

**dllexport vs .def 的差异**：

```
╔══════════════════╦═══════════════════════════╦═══════════════════════════╗
║  能力             ║  __declspec(dllexport)    ║  .def 文件                ║
╠══════════════════╬═══════════════════════════╬═══════════════════════════╣
║ 指定导出序号      ║ ❌ 无法                    ║ ✅ @1, @2 精确控制        ║
║ NONAME(只序号导出)║ ❌ 无法                    ║ ✅ 可以减少 DLL 体积       ║
║ 重命名导出符号    ║ ❌                         ║ ✅ 在 def 中指定别名       ║
║ 内联到代码中      ║ ✅ 直接在头文件中           ║ ❌ 需要额外的 .def 文件   ║
║ C++ 类导出       ║ ✅ 自动处理所有成员         ║ ❌ 必须手动列出所有符号   ║
╚══════════════════╩═══════════════════════════╩═══════════════════════════╝
```

**实际工程建议**：常规代码用 `__declspec(dllexport)` + 宏开关；需要精确控制 ABI（如系统级 API）或需要导出无名字的序号时，辅助使用 .def 文件。

---

## 三、导入端：__declspec(dllimport)

### 3.1 为什么需要 dllimport？

很多人问：**去掉 dllimport，代码也能正常编译和运行，为什么还要它？**

答案在于**编译器生成的指令不同**：

```asm
; 没有 dllimport 时 —— 编译器生成间接跳转
    call add                  ; add 是链接器生成的 thunk
                              ; 即: jmp [__imp_add]

; 有 dllimport 时 —— 编译器知道符号在外部 DLL 中
    call [__imp_add]          ; 直接通过 IAT 指针调用
```

两者的代码路径对比：

```
无 dllimport:
    call add ──▶ 跳转到 thunk 代码 ──▶ jmp [__imp_add] ──▶ 实际 DLL 函数

有 dllimport:
    call [__imp_add] ──▶ 直接访问 IAT ──▶ 实际 DLL 函数
```

**每次调用省一条 jmp 指令**。对于频繁调用的函数，这是一个可测量的性能优化。更重要的是，**对于全局数据**，dllimport 是必需的：

```cpp
// 没有 dllimport: 编译器为 g_counter 生成一个本地副本
//                  不同模块引用 g_counter 会指向不同的地址！
// 有 dllimport:   编译器生成间接寻址 __imp_g_counter
//                  所有模块都通过 IAT 访问同一个 DLL 中的实体
```

### 3.2 导入表 (Import Table) 的结构

导入表是 PE 文件的另一张关键表，位于 `DataDirectory[1]`：

```
PE → OptionalHeader.DataDirectory[1] → IMAGE_IMPORT_DESCRIPTOR 数组
═══════════════════════════════════════════════════════════════════════════

IMAGE_IMPORT_DESCRIPTOR (每个被引用的 DLL 一条)
┌──────────────────────────┬─────────────────────────────────────────────┐
│  Name: "foo.dll"         │  DLL 的名字                                 │
│  OriginalFirstThunk ────▶│  INT (Import Name Table) —— 导入符号名数组    │
│  FirstThunk ────────────▶│  IAT (Import Address Table) —— 运行时填地址   │
│  TimeDateStamp           │  绑定时间戳                                 │
│  ForwarderChain          │  转发链                                     │
└──────────────────────────┴─────────────────────────────────────────────┘

INT (链接时存在)                       IAT (运行时填充)
┌──────────────────────┐              ┌──────────────────────┐
│ [0] "add"  ───────── │─────────────▶│ [0] 0x1000A000        │ ← OS加载器写入
│ [1] "sub"  ───────── │─────────────▶│ [1] 0x1000A100        │
│ [2] "mul"  ───────── │─────────────▶│ [2] 0x1000A200        │
└──────────────────────┘              └──────────────────────┘
                                               │
                                               ▼
                                       foo.dll 在内存中的实际地址
```

### 3.3 运行时的完整绑定流程

```
OS 加载器 (ntdll.dll!Ldr*) 的工作

1. 读取 PE 头，找到导入表 (IMAGE_IMPORT_DESCRIPTOR)
2. 遍历每个 IMAGE_IMPORT_DESCRIPTOR:
   a. 读取 Name → "foo.dll"
   b. 调用 LdrLoadDll 加载 foo.dll
      ├── 检查是否已加载 (DLL 引用计数机制)
      ├── 按 DLL 搜索顺序查找文件
      ├── 映射 PE 节区到内存
      └── 调用 DllMain(DLL_PROCESS_ATTACH)
   c. 遍历 INT 中的每个符号:
      ├── 按名字: 在 foo.dll 导出表中查找 → 得到 RVA → 计算实际地址
      ├── 按序号: 直接查 AddressOfFunctions[序号 - Base]
      └── 将实际地址写入 IAT[对应的槽位]
3. 所有 DLL 加载完毕后，跳转到 app.exe 的入口点
```

**绑定 (Binding) 优化**：

```
普通加载:                    绑定后:
每次启动都遍历符号表查找      链接时把目标 DLL 的符号地址快照写入 PE
速度: O(n × m)              速度: O(1) —— 只验证快照是否过期

绑定时机: link.exe /bind   或  bind.exe 后期处理

如果目标 DLL 更新后地址变了怎么办？
→ PE 中有 TimeDateStamp 校验，过期则回退到正常查找
```

---

## 四、延迟加载 (Delay-Load)

延迟加载是 MSVC 提供的一种介于隐式加载和显式加载之间的机制。

### 4.1 工作原理

```
正常导入:                         延迟加载导入:
  进程启动即加载 DLL                  第一次调用函数时才加载 DLL
  
  PE 加载器必须在 main() 之前         链接器生成 __delayLoadHelper2 thunk
  把所有 DLL 加载完成                 thunk 在第一次调用时先加载 DLL、
                                      再解析符号、然后跳到真实地址
```

### 4.2 实现机制

```cpp
// 启用延迟加载
// 1. 代码中: #include <delayimp.h>
// 2. 链接参数: /DELAYLOAD:foo.dll
// 3. 链接库: delayimp.lib

// delayimp.lib 中的 __delayLoadHelper2 伪代码:
LONG __delayLoadHelper2(ImgDelayDescr* pdd, ...) {
    if (!已加载) {
        LoadLibrary(pdd->szDllName);
        // 遍历延迟加载符号表，逐个 GetProcAddress
        // 填充延迟加载 IAT
    }
    return 实际函数地址;
}
```

### 4.3 延迟加载的 PE 结构差异

延迟加载在 PE 中有自己独立的表 (`DataDirectory[13]`)：

```
标准导入表 (DataDirectory[1]):           延迟加载导入表 (DataDirectory[13]):
  需要 foo.dll 中的 add, sub              需要 bar.dll 中的 init, cleanup
  必须进程启动时全部解析                   第一次调用时才解析

两个表各自由链接器独立生成，OS 加载器只处理标准导入表，
延迟加载表由 __delayLoadHelper2 在运行时处理。
```

### 4.4 延迟加载的 hook 机制

```cpp
#include <delayimp.h>

// 自定义加载失败处理器
FARPROC WINAPI delayLoadFailureHook(unsigned dliNotify, PDelayLoadInfo pdli) {
    if (dliNotify == dliFailLoadLib) {
        // DLL 不存在时给出友好提示
        printf("Failed to load: %s\n", pdli->szDll);
        return NULL; // 或返回一个 stub 函数指针
    }
    return NULL;
}

// 注册 hook
PfnDliHook __pfnDliFailureHook2 = delayLoadFailureHook;
```

---

## 五、名称修饰 (Name Mangling) 与 C/C++ 互操作

### 5.1 MSVC C++ 名称修饰规则

MSVC 使用特有的名称修饰方案（与 Itanium C++ ABI 的修饰方案不同）：

```cpp
// 源代码
int __cdecl add(int a, int b);
int __stdcall sub(int a, int b);
int __fastcall mul(int a, int b);
int __vectorcall div(int a, int b);
class Foo { int bar(double); };

// MSVC 修饰后的链接名 (x64 下调用约定不再修饰，因为 x64 统一为 __fastcall)
// x86:
add   → ?add@@YAHHH@Z             ; ?[名]@@YA[返回类型][参数类型]@Z
sub   → ?sub@@YGHHH@Z             ; YG = __stdcall
mul   → ?mul@@YIHHH@Z             ; YI = __fastcall
div   → ?div@@YQHHH@Z             ; YQ = __vectorcall
bar   → ?bar@Foo@@QAEHNH@Z        ; QAE = public, N = double, H = int

// 前缀 ? 开头表示 C++ 修饰名
```

### 5.2 extern "C" 的作用

```cpp
#ifdef __cplusplus
extern "C" {
#endif

// 这些符号用 C 链接规则进行修饰（仅加前缀下划线或 @N）
// 不做 C++ 的命名空间、类名、参数类型编码
int add(int a, int b);

#ifdef __cplusplus
}
#endif
```

```
extern "C" 的 MSVC 修饰结果:

    x86 __cdecl:      _add       (加前导下划线)
    x86 __stdcall:    _add@8     (加前导下划线 + @参数总字节数)
    x64:              add        (不做任何修饰！)

对比 C++ 修饰:        ?add@@YAHHH@Z  (包含返回类型和参数类型编码)
```

### 5.3 跨模块 C++ 接口的陷阱

导出 C++ 类时最容易踩的坑：

```cpp
// ⚠️ 危险：不同编译版本下的 std::string 内存布局可能不同
class FOO_API Logger {
public:
    void log(const std::string& msg);  // DLL 和 EXE 必须用同一版本 MSVC 编译
};

// ✅ 安全：使用 C ABI 边界
class Logger {
public:
    void log(const char* msg);         // const char* 内存布局是确定的
};
```

**根本原因**：C++ 没有标准的 ABI。不同 MSVC 版本、不同编译选项（/MD vs /MT、Debug vs Release、_HAS_ITERATOR_DEBUGGING）下，STL 容器的内存布局和分配器行为都可能不同。跨 DLL 边界传递 C++ 对象的前提是**所有模块使用完全相同的编译配置**。

---

## 六、显式加载 vs 隐式加载

### 6.1 两种加载方式的完整对比

```
╔══════════════════╦══════════════════════╦══════════════════════╗
║                  ║  隐式加载 (Import)    ║  显式加载 (LoadLibrary)║
╠══════════════════╬══════════════════════╬══════════════════════╣
║ DLL 加载时机      ║ 进程启动时             ║ 代码调用 LoadLibrary 时  ║
║ DLL 缺失时的行为  ║ 进程弹错误框，无法启动   ║ LoadLibrary 返回 NULL   ║
║ 符号绑定时机      ║ 进程启动时             ║ 调用 GetProcAddress 时  ║
║ 头文件依赖        ║ 需要 .h + .lib        ║ 只需要函数指针声明        ║
║ 使用便捷性        ║ 直接调用，像普通函数    ║ 需要手动声明函数指针       ║
║ C++ 类使用        ║ 可以直接导出整个类     ║ 只能获取 C 函数，难以获取类 ║
║ 热插拔            ║ 不支持                ║ 支持 (FreeLibrary 后重加载)║
╚══════════════════╩══════════════════════╩══════════════════════╝
```

### 6.2 显式加载的代码模式

```cpp
// 显式加载 DLL
HMODULE hDll = LoadLibraryW(L"foo.dll");
if (!hDll) {
    // 处理加载失败
    DWORD err = GetLastError();
    return;
}

// 获取函数指针
typedef int (*AddFunc)(int, int);
AddFunc add = (AddFunc)GetProcAddress(hDll, "add");
if (!add) {
    // 符号未找到
    FreeLibrary(hDll);
    return;
}

// 调用
int result = add(3, 4);

// 释放
FreeLibrary(hDll);
```

### 6.3 DLL 引用计数

LoadLibrary/FreeLibrary 基于引用计数：

```
进程启动 → OS 隐式加载 foo.dll, refcount = 1
LoadLibrary("foo.dll")   → refcount = 2  (同一模块不再加载，只递增计数)
LoadLibrary("foo.dll")   → refcount = 3
FreeLibrary(hDll)        → refcount = 2  (不会真正卸载)
FreeLibrary(hDll)        → refcount = 1
FreeLibrary(hDll)        → refcount = 0  → DllMain(DLL_PROCESS_DETACH) → 卸载
```

---

## 七、DLL 搜索顺序

当加载器需要找到 `foo.dll` 时，Windows 按以下顺序搜索：

```
标准搜索顺序 (未设置 LOAD_LIBRARY_SEARCH_* 标志时)
═══════════════════════════════════════════════════════

1. 进程的 .exe 所在目录
2. 当前工作目录 (GetCurrentDirectory)
3. Windows 系统目录 (GetSystemDirectory)  → C:\Windows\System32
4. 16位系统目录                             → C:\Windows\System
5. Windows 目录 (GetWindowsDirectory)     → C:\Windows
6. PATH 环境变量中的目录

⚠️ SafeDllSearchMode (默认开启):
   当前工作目录的搜索位置被移到第 5 位，在 Windows 目录之后
```

**DLL 劫持防护**：

```cpp
// ✅ 推荐：限制搜索范围
SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32);

// ✅ 推荐：使用完全限定路径
LoadLibraryW(L"C:\\Program Files\\MyApp\\foo.dll");

// ❌ 危险：仅给文件名，依赖搜索顺序
LoadLibraryW(L"foo.dll");
```

---

## 八、DllMain 入口点

### 8.1 调用时机

```cpp
BOOL APIENTRY DllMain(HMODULE hModule,
                      DWORD   ul_reason_for_call,
                      LPVOID  lpReserved)
{
    switch (ul_reason_for_call) {
    case DLL_PROCESS_ATTACH:
        // DLL 被加载到进程地址空间时
        // ⚠️ 不要在这里做复杂操作！
        break;
    case DLL_PROCESS_DETACH:
        // DLL 从进程中卸载时
        // lpReserved == NULL 表示 FreeLibrary 导致
        // lpReserved != NULL 表示进程退出导致
        break;
    case DLL_THREAD_ATTACH:
        // 新线程创建时（可以禁用: DisableThreadLibraryCalls）
        break;
    case DLL_THREAD_DETACH:
        // 线程退出时
        break;
    }
    return TRUE;
}
```

### 8.2 DllMain 中的限制

DllMain 在加载器锁 (Loader Lock) 持有期间执行。**在 DllMain 中做的事必须极其谨慎**：

```
可以安全做的事:                      不能做的事:
─────────────────                    ─────────────
✅ 初始化 CRT (自动完成)              ❌ 调用 LoadLibrary / FreeLibrary  (死锁)
✅ 初始化全局变量                     ❌ 调用 GetProcAddress 以外的 API
✅ 创建/初始化关键段 (CRITICAL_SECTION) ❌ 创建线程 / 等待线程同步
✅ TLS 分配                          ❌ 调用 COM / RPC 函数
                                     ❌ 调用 printf (可能触发 LoadLibrary)
                                     ❌ 操作注册表
```

---

## 九、PE 文件中导入导出表的位置全图

```
PE 文件内存映射
═══════════════════════════════════════════════════════════════════════

┌──────────────────────────┐  0x00000000
│  IMAGE_DOS_HEADER        │
│    e_lfanew ────────────────────┐
├──────────────────────────┤      │
│  DOS Stub                │      │
├──────────────────────────┤      │  ┌──────────────────────────────┐
│  IMAGE_NT_HEADERS        │ ◀────┘  │ IMAGE_FILE_HEADER            │
│    Signature: "PE\0\0"   │         │ IMAGE_OPTIONAL_HEADER         │
│                          │         │   DataDirectory[16]:          │
│                          │         │     [0] EXPORT ──────────┐   │
│                          │         │     [1] IMPORT ───────┐  │   │
│                          │         │     [13] DELAY_IMPORT │  │   │
├──────────────────────────┤         ├──────────────────────────┤   │
│  SECTION .text  (代码)    │         │                          │   │
├──────────────────────────┤         │                          │   │
│  SECTION .rdata (只读数据)│         │                          │   │
│    导出表 ◀────────────────────────┘                          │   │
│    导入表 ◀───────────────────────────────────────────────────┘   │
│    延迟加载导入表 ◀───────────────────────────────────────────────┘   │
├──────────────────────────┤
│  SECTION .data  (读写数据)│
│    (包括 IAT, 因为运行时 │
│     需要写入函数地址)      │
├──────────────────────────┤
│  SECTION .reloc (重定位)  │
├──────────────────────────┤
│  ...                     │
└──────────────────────────┘
```

**关键设计细节**：IAT 在传统上放在 `.idata` 节或 `.rdata` 节中。在 x64 和启用了 `/GUARD:CF` (Control Flow Guard) 的构建中，IAT 被放在一个独立的只读节中（因为它不应该在加载后改变），而 OS 加载器使用写时复制和临时页表权限来填充地址——这题外话，不再展开。

---

## 十、实战：一个完整的多模块示例

### 10.1 项目结构

```
math_dll/                          app/
├── math.h                         ├── main.cpp
├── math.cpp                       
├── math.def (可选)                
├── math.vcxproj                   
└── 输出: math.dll + math.lib      
```

### 10.2 DLL 端代码

```cpp
// math.h
#pragma once

#ifdef MATH_DLL_EXPORTS
  #define MATH_API __declspec(dllexport)
#else
  #define MATH_API __declspec(dllimport)
#endif

#ifdef __cplusplus
extern "C" {
#endif

MATH_API int add(int a, int b);
MATH_API int sub(int a, int b);
MATH_API int mul(int a, int b);

// 按序号导出的函数（配合 .def 使用）
MATH_API int div_safe(int a, int b);

#ifdef __cplusplus
}
#endif
```

```cpp
// math.cpp
#define MATH_DLL_EXPORTS
#include "math.h"

int add(int a, int b) { return a + b; }
int sub(int a, int b) { return a - b; }
int mul(int a, int b) { return a * b; }
int div_safe(int a, int b) { return (b == 0) ? 0 : a / b; }
```

### 10.3 应用程序端代码

```cpp
// main.cpp
#include <windows.h>
#include <cstdio>

// 方式一: 隐式链接（需要 math.lib）
// #include "math.h"
// #pragma comment(lib, "math.lib")

// 方式二: 显式加载（不需要 .lib 和 .h）
typedef int (*MathFunc)(int, int);

int main() {
    HMODULE hMath = LoadLibraryW(L"math.dll");
    if (!hMath) {
        printf("Failed to load math.dll, error: %lu\n", GetLastError());
        return 1;
    }

    MathFunc add = (MathFunc)GetProcAddress(hMath, "add");
    MathFunc sub = (MathFunc)GetProcAddress(hMath, "sub");

    if (add) printf("3 + 4 = %d\n", add(3, 4));
    if (sub) printf("10 - 7 = %d\n", sub(10, 7));

    FreeLibrary(hMath);
    return 0;
}
```

---

## 十一、常见问题与最佳实践

### 11.1 链接器错误 LNK2019: unresolved external symbol "__declspec(dllimport)..."

```
原因: 链接器找不到符号对应的 DLL 地址
排查:
  1. 是否链入了正确的导入库 (.lib)?
  2. 导入库是否与 DLL 版本匹配？
  3. 符号名是否匹配？(用 dumpbin /exports xxx.dll 查看导出名)
  4. 使用时是否正确 #define 了导出宏？
```

### 11.2 运行时错误: 应用程序无法启动 (0xc000007b)

```
原因: 32位 .exe 加载了 64位 DLL，或反之
排查:
  1. dumpbin /headers app.exe | findstr "machine"  → 看架构
  2. dumpbin /headers math.dll | findstr "machine" → 对照检查
```

### 11.3 运行时错误: 找不到 DLL (0xc0000135 / 0x7E)

```
原因: DLL 不在搜索路径中
排查:
  1. 把 DLL 放到 .exe 同目录（最简单）
  2. 检查 PATH 环境变量
  3. 使用 Process Monitor 查看实际搜索了哪些路径
  4. 考虑使用 SetDefaultDllDirectories 锁定搜索范围
```

### 11.4 调试工具速查

```
dumpbin /exports foo.dll      查看导出表
dumpbin /imports app.exe      查看导入表
dumpbin /headers app.exe      查看 PE 头信息
dumpbin /dependents app.exe   查看依赖的 DLL 列表
dumpbin /exports foo.dll /out:exports.txt  重定向到文件

depends.exe (Depency Walker)  图形化依赖查看 (已停止更新但有社区版)
Dependencies (lucasg/github)  现代替代品，支持 Win10+ API sets
```

### 11.5 最佳实践总结

```
1. 头文件使用统一的导入导出宏模式
     → #ifdef XXX_EXPORTS / __declspec(dllexport) / __declspec(dllimport)

2. 跨 DLL 边界的 C 接口使用 extern "C"
     → 避免 C++ 名称修饰导致的符号不匹配

3. 跨 DLL 边界避免传递 C++ STL 对象
     → 使用 POD 类型、const char*、或自己保证 ABI 兼容性

4. 为公开 API 的 DLL 提供 .def 文件控制序号
     → 序号不变，调用方可以不重新链接

5. 尽量用隐式链接，延迟加载作为性能优化
     → 显式加载仅用于插件系统和可选组件

6. DLL 放在 .exe 同目录
     → 这是 Windows 搜索优先级最高的路径

7. 使用 /MD (动态 CRT) 而非 /MT (静态 CRT)
     → DLL 和 EXE 使用同一份 CRT，避免跨模块内存管理问题

8. 发布 Release 构建时运行 dumpbin 检查
     → 确认导出了正确的符号，没有意外导出
```

---

## 关键概念速查表

| 概念 | 说明 | 位置/命令 |
|------|------|-----------|
| `__declspec(dllexport)` | 标记符号为导出 | 源码编译指令 |
| `__declspec(dllimport)` | 标记符号需从 DLL 导入 | 源码编译指令 |
| 导出表 (Export Table) | DLL 中记录"我能提供什么"的表 | PE DataDirectory[0] |
| 导入表 (Import Table) | EXE/DLL 中记录"我需要什么"的表 | PE DataDirectory[1] |
| 导入库 (.lib) | 符号到 DLL 的映射，链接器使用 | 链接时输入 |
| IAT (Import Address Table) | 运行时 OS 填充函数地址的槽位数组 | PE .idata / .rdata 节 |
| INT (Import Name Table) | IAT 的只读副本，保存原始符号名 | PE .idata 节 |
| 延迟加载 | 第一次调用时才加载 DLL 的机制 | DataDirectory[13] + delayimp.lib |
| .def 文件 | 显式控制导出符号的名字和序号 | 链接器 /DEF 参数 |
| `extern "C"` | 禁用 C++ 名称修饰，使用 C 链接规则 | 源码编译指令 |
| `GetProcAddress` | 按名字或序号从已加载 DLL 获取函数地址 | kernel32.dll API |
| `LoadLibrary` | 显式加载 DLL 到进程地址空间 | kernel32.dll API |
| `FreeLibrary` | 递减 DLL 引用计数，可能卸载 | kernel32.dll API |
| `DllMain` | DLL 的入口点函数，在加载/卸载/线程事件时被调用 | DLL 源码 |
| `dumpbin` | MSVC 自带的 PE 分析工具 | VS 开发者命令提示符 |
| `/DLL` | 链接器选项，指定输出为动态库 | link.exe 参数 |
| `/DEF` | 链接器选项，指定模块定义文件 | link.exe 参数 |
| `/DELAYLOAD` | 链接器选项，启用延迟加载 | link.exe 参数 |
