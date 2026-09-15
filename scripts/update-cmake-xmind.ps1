param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

function New-Topic {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [object[]]$Children = @()
    )

    $topic = [ordered]@{
        id    = [guid]::NewGuid().ToString()
        class = 'topic'
        title = $Title
    }

    if ($Children.Count -gt 0) {
        $topic.children = [ordered]@{ attached = $Children }
    }

    return [pscustomobject]$topic
}

if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
    throw "XMind source not found: $SourcePath"
}

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$workDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("kb-xmind-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workDirectory | Out-Null

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($SourcePath, $workDirectory)

    $contentPath = Join-Path $workDirectory 'content.json'
    if (-not (Test-Path -LiteralPath $contentPath)) {
        throw 'The XMind archive does not contain content.json.'
    }

    $document = Get-Content -LiteralPath $contentPath -Raw | ConvertFrom-Json
    $sheet = $document[0]
    $root = $sheet.rootTopic
    $lowerBranch = $root.children.attached | Where-Object { $_.title -eq '下层' } | Select-Object -First 1
    if ($null -eq $lowerBranch) { throw 'Cannot find the 下层 branch.' }

    $toolchain = $lowerBranch.children.attached | Where-Object { $_.title -like '工具链层*' } | Select-Object -First 1
    if ($null -eq $toolchain) { throw 'Cannot find the 工具链层 branch.' }

    $toolchain.title = '工具链与二进制生态层（可组合）'
    $description = $toolchain.children.attached | Select-Object -First 1
    $description.title = '真正完成源码到二进制转换的最低层。这里不是一个不可拆分的“工具包”，而是一组可以组合的组件：编译器、目标平台、对象文件格式、ABI、链接器、C++ 标准库、C/平台运行时、编译器运行时与 SDK。能否组合不看品牌是否相同，而看它们是否遵守兼容的二进制合同。'

    $components = New-Topic '把工具链继续拆开（解决兼容问题的关键）' @(
        (New-Topic '编译器驱动与前端' @(
            (New-Topic 'clang-cl：Clang 的 cl.exe 兼容驱动，接受 /MT、/MD、/EHsc 等 MSVC 风格参数'),
            (New-Topic 'cl.exe：Microsoft C/C++ 编译器'),
            (New-Topic '编译器只负责翻译与生成调用；它不必亲自实现 malloc、std::string 等运行时能力')
        )),
        (New-Topic '目标平台与对象文件格式' @(
            (New-Topic 'CPU 架构：x86 / x64 / ARM64 必须匹配'),
            (New-Topic 'Windows MSVC 目标通常生成 COFF .obj；Linux 通常使用 ELF；macOS 使用 Mach-O'),
            (New-Topic '目标三元组比“编译器品牌”更能说明产物属于哪套生态')
        )),
        (New-Topic 'ABI（二进制合同）' @(
            (New-Topic '规定调用约定、名称修饰、类/结构体布局、虚表、异常、RTTI 等'),
            (New-Topic 'clang-cl 在 Windows/MSVC target 下努力兼容 Microsoft C++ ABI'),
            (New-Topic 'API 相同不代表 ABI 相同；能编译也不代表能安全跨 DLL 传对象')
        )),
        (New-Topic '链接器' @(
            (New-Topic 'link.exe 与 lld-link 都能处理 Windows COFF，并不是 MSVC 编译器的专属搭档'),
            (New-Topic '链接器负责解析符号、重定位地址、组合 .obj/.lib，不能修复对象布局不一致')
        )),
        (New-Topic '库与运行时（不要再统称“运行库”）' @(
            (New-Topic 'C++ 标准库：MSVC STL / libc++ / libstdc++；提供 string、vector、iostream 等'),
            (New-Topic 'C/平台运行时：Windows 的 UCRT + VCRuntime；提供启动、堆、stdio、异常底座等'),
            (New-Topic '编译器运行时：LLVM compiler-rt / GCC libgcc；提供编译器生成的底层辅助操作'),
            (New-Topic '操作系统 SDK：Windows SDK 头文件和导入库，例如 windows.h、kernel32.lib')
        ))
    )

    $windowsCombination = New-Topic '为什么 Clang 可以使用 Microsoft 运行时' @(
        (New-Topic '核心原因：Clang 面向 Windows/MSVC target 生成兼容的 COFF、调用约定和符号，然后链接 Microsoft 提供的运行时实现'),
        (New-Topic 'Clang 不等于 libc++：clang-cl 默认经常使用 MSVC STL；更换编译器并不会自动更换 C++ 标准库'),
        (New-Topic '/MT 与 /MD 选择 Microsoft CRT 的链接模式，不是在选择编译器' @(
            (New-Topic '/MT：静态、多线程 CRT；运行时代码进入各自模块'),
            (New-Topic '/MD：DLL 版、多线程 CRT；通过导入库使用运行时 DLL'),
            (New-Topic '同一次链接及跨模块交互应统一配置；跨 DLL 内存仍遵守“谁分配，谁释放”')
        )),
        (New-Topic '常见可行组合' @(
            (New-Topic 'cl.exe + MSVC STL + UCRT/VCRuntime + link.exe'),
            (New-Topic 'clang-cl + MSVC STL + UCRT/VCRuntime + link.exe 或 lld-link'),
            (New-Topic 'clang-cl + libc++ + UCRT/VCRuntime + compiler-rt + lld-link（需要成套配置）')
        ))
    )

    $caseStudy = New-Topic '本次 Chromium / client.dll 实例' @(
        (New-Topic '实际组合：clang-cl 17 + Windows x86/MSVC ABI/COFF + Chromium libc++ + Microsoft CRT /MT + clang_rt.builtins-i386 + lld-link'),
        (New-Topic '浏览器侧 std::string 来自 Chromium libc++，符号特征为 std::__Cr::basic_string'),
        (New-Topic '旧 client.lib 使用 MSVC STL；两种 string 的符号、布局、内联实现和 allocator 约定可能不同'),
        (New-Topic '必须同时匹配：libc++ 头文件、__config_site、ABI 宏、预编译 libc++.lib、Clang 版本、架构和 CRT 模式'),
        (New-Topic '验证链路' @(
            (New-Topic '/showIncludes：确认 <string> 来自交付的 libc++ 目录'),
            (New-Topic 'llvm-nm / dumpbin：检查 __Cr 符号与未解析符号'),
            (New-Topic '/VERBOSE:LIB：确认每个符号由哪个库提供'),
            (New-Topic '真实运行：覆盖创建、调用、异常和释放路径；符号相似不能代替运行验证')
        ))
    )

    $boundary = New-Topic '跨 DLL 的长期安全设计' @(
        (New-Topic '优先暴露 C ABI，不直接暴露 std::string、std::vector、模板、异常和实现私有类型'),
        (New-Topic '固定宽度整数、结构体大小/版本、对齐、字符编码和调用约定'),
        (New-Topic '谁创建，谁销毁：DLL 提供配套 release/destroy 函数，避免跨内存域释放'),
        (New-Topic 'Release/Debug 不是抽象上的绝对边界；真正边界是 ABI 和运行时配置。但 MSVC Debug STL、迭代器调试等经常改变 ABI，因此工程上通常要求一致')
    )

    $questions = New-Topic '以后听到“依赖 MSVC”时继续追问' @(
        (New-Topic '依赖 cl.exe 编译器，还是 Microsoft C++ ABI？'),
        (New-Topic '依赖 MSVC STL，还是 UCRT / VCRuntime？'),
        (New-Topic '依赖 link.exe，还是只要求 COFF 格式？'),
        (New-Topic '依赖 MSBuild，还是任何能调度同一套命令的构建工具都可以？')
    )

    $existing = @($description.children.attached)
    $description.children.attached = @($existing + $components + $windowsCombination + $caseStudy + $boundary + $questions)

    $detached = @($root.children.detached)
    foreach ($topic in $detached) {
        if ($topic.title -like '影响库的通用性的因素*') {
            $topic.title = @'
影响库二进制兼容性的坐标：
平台与目标格式：操作系统、COFF/ELF/Mach-O 等需要被工具识别。
架构：x86、x64、ARM64 以及指令集要求必须匹配。
ABI：调用约定、名称修饰、类布局、异常、RTTI、对齐等需要兼容。
C++ 标准库：MSVC STL、libc++、libstdc++ 的类型通常不能直接跨边界。
C/平台运行时：/MT、/MD、Debug/Release 运行时与内存所有权需要一致设计。
编译器运行时与 SDK：所有生成的辅助符号和系统 API 都必须得到满足。
编译宏与配置头：iterator debug、ABI namespace、断言、可见性等可能改变布局或符号。
依赖闭包：库的传递依赖、版本与链接顺序必须完整。
构建模式：不是简单的“Release 只能配 Release”，真正要求是 ABI 和运行时配置兼容；但实践中通常统一模式以规避调试 STL 等差异。
'@
        }
    }

    $json = ConvertTo-Json -InputObject @($sheet) -Depth 100 -Compress
    [System.IO.File]::WriteAllText($contentPath, $json, [System.Text.UTF8Encoding]::new($false))

    if (Test-Path -LiteralPath $OutputPath) {
        Remove-Item -LiteralPath $OutputPath -Force
    }
    [System.IO.Compression.ZipFile]::CreateFromDirectory($workDirectory, $OutputPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)

    $archive = [System.IO.Compression.ZipFile]::OpenRead($OutputPath)
    try {
        $required = @('content.json', 'manifest.json', 'metadata.json')
        foreach ($name in $required) {
            if (-not ($archive.Entries | Where-Object { $_.FullName -eq $name })) {
                throw "Generated XMind is missing $name"
            }
        }
    }
    finally {
        $archive.Dispose()
    }

    Write-Output "Generated: $OutputPath"
}
finally {
    if (Test-Path -LiteralPath $workDirectory) {
        Remove-Item -LiteralPath $workDirectory -Recurse -Force
    }
}
