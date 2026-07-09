/* eslint-disable @next/next/no-img-element */
import type { FieldMedia } from "@/lib/types";

function toYouTubeEmbed(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}
function toVimeoEmbed(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : null;
}

export function MediaView({ media }: { media: FieldMedia }) {
  if (!media?.url) return null;
  const align = media.align ?? "center";
  const justify =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  const boxStyle: React.CSSProperties = {
    width: media.width ? `${media.width}%` : "auto",
    maxWidth: "100%",
  };
  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: media.height ? `${media.height}px` : "auto",
    objectFit: "cover",
    borderRadius: 12,
    display: "block",
  };

  let inner: React.ReactNode;
  if (media.kind === "video") {
    const embed = toYouTubeEmbed(media.url) || toVimeoEmbed(media.url);
    if (embed) {
      inner = (
        <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden" }}>
          <iframe
            src={embed}
            title="vídeo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      );
    } else {
      inner = <video src={media.url} controls style={mediaStyle} />;
    }
  } else {
    inner = <img src={media.url} alt={media.alt || ""} style={mediaStyle} />;
  }

  return (
    <div style={{ display: "flex", justifyContent: justify, marginBottom: 20 }}>
      <div style={boxStyle}>{inner}</div>
    </div>
  );
}
