import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Portal Kreator | Crowncare",
    description: "Selamat datang di Portal Kolaborasi Crowncare. Cek progres proyek dan kelola data kolaborasi kamu di sini secara transparan.",
    openGraph: {
        title: "Portal Kreator Crowncare",
        description: "Cek progres kolaborasi dan kelola dokumen kamu di satu platform aman.",
        url: "https://crowncare.site",
        images: [
            {
                url: "https://crowncare.site/og-image.png",
                width: 1200,
                height: 630,
                alt: "Crowncare Creator Portal",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Portal Kreator Crowncare",
        description: "Kelola kolaborasi kamu dengan mudah dan transparan.",
        images: ["https://crowncare.site/og-image.png"],
    },
};

export default function CreatorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
