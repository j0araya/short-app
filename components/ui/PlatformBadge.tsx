const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  youtube: { label: "YouTube", color: "#ff0000" },
  tiktok: { label: "TikTok", color: "#010101" },
  instagram: { label: "Instagram", color: "#e1306c" },
};

export function PlatformBadge({ platform }: { platform: string }) {
  const config = PLATFORM_CONFIG[platform] ?? { label: platform, color: "#6366f1" };

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ backgroundColor: config.color }}
    >
      {config.label}
    </span>
  );
}
