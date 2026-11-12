interface Props {
  type: "audio" | "image" | "video" | "document";
  mediaPath: string | null;
  content: string | null;
}

export function MediaMessage({ type, mediaPath, content }: Props) {
  const src = mediaPath ? `/api/media/${mediaPath}` : null;

  if (!src) {
    return <span className="italic opacity-60">A transferir {type}…</span>;
  }

  if (type === "audio") {
    return (
      <audio controls className="max-w-[220px]" preload="metadata">
        <source src={src} />
        Áudio não suportado neste browser.
      </audio>
    );
  }

  if (type === "image") {
    return (
      <a href={src} target="_blank" rel="noreferrer">
        <img
          src={src}
          alt="imagem"
          className="max-w-[220px] max-h-48 rounded-lg object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  if (type === "video") {
    return (
      <video controls className="max-w-[220px] max-h-48 rounded-lg" preload="metadata">
        <source src={src} />
      </video>
    );
  }

  // document
  return (
    <a href={src} target="_blank" rel="noreferrer" className="underline text-blue-600 text-sm">
      {content ?? "Documento"}
    </a>
  );
}
