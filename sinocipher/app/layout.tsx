import type { Metadata } from 'next';
import './globals.css';

const siteOrigin = 'https://crypto-product-atlas-cn.apt-smile-0408.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: '密码产品知识地图',
  description: '面向密码行业新人的详细知识库：密码原理、产品能力与部署关系双向关联。',
  openGraph: {
    title: '密码产品知识地图',
    description: '从密码原理到 30 类产品：知识专题、产品照应、部署关系、对比与名词词典。',
    images: [{ url: new URL('/og.png', siteOrigin).toString(), width: 1680, height: 945, alt: '密码产品知识地图' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '密码产品知识地图',
    description: '从密码原理到 30 类产品：知识专题、产品照应、部署关系、对比与名词词典。',
    images: [new URL('/og.png', siteOrigin).toString()],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a
          href="http://localhost:5004/"
          className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3.5 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur transition hover:border-primary hover:text-primary"
          title="返回 YJ Knowledge Bank 主页"
        >
          <span aria-hidden>←</span>返回主页
        </a>
        {children}
      </body>
    </html>
  );
}
