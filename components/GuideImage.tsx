"use client";

import { useEffect, useState } from "react";
import { PLAYER_GUIDE_ANNOTATIONS } from "../lib/data/playerGuideAnnotations";

type GuideImageProps = {
  src: string;
  alt: string;
};

const normalizeGuideSrc = (src: string): string => {
  const cleaned = src.split("#")[0]?.split("?")[0] ?? src;
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    try {
      return new URL(cleaned).pathname;
    } catch {
      return cleaned;
    }
  }
  return cleaned;
};

export function GuideImage({ src, alt }: GuideImageProps) {
  const normalizedSrc = normalizeGuideSrc(src);
  const annotations = PLAYER_GUIDE_ANNOTATIONS[normalizedSrc];
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  if (!annotations) {
    return <img src={src} alt={alt} loading="lazy" />;
  }

  const { size, boxes } = annotations;

  return (
    <div className="guideImage">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        width={size.width}
        height={size.height}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
      {isLoaded && !hasError ? (
        <div className="guideOverlay" aria-hidden="true">
          {boxes.map((box) => {
            const pinX = box.x + Math.min(24, box.w / 2);
            const pinY = box.y + Math.min(24, box.h / 2);
            const left = (pinX / size.width) * 100;
            const top = (pinY / size.height) * 100;
            return (
              <div
                key={box.id}
                className="guidePin"
                style={{
                  left: `${left}%`,
                  top: `${top}%`
                }}
              >
                {box.id}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
