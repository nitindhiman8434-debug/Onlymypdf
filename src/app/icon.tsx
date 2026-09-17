import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const iconSrc = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/logos/clean/logo-om-icon.png")
).toString("base64")}`;

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconSrc}
          alt=""
          width={32}
          height={32}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { ...size }
  );
}
