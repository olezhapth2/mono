import Gallery from "@/components/InfiniteGallery";
import { assetUrl } from "@/lib/assetUrl";
import { GALLERY_IMAGES } from "@/lib/galleryImages";
import { FLY_IMAGES } from "@/lib/flyImages";

export default function Home() {
  return (
    <main className="h-[100dvh] w-full bg-canvas p-2 sm:p-3">
      <div className="relative h-full w-full overflow-hidden rounded-[20px]">
        <img
          src={assetUrl("/frame-bg.png")}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full origin-top scale-[1.2] object-contain object-top"
        />
        <div className="absolute inset-0">
          <Gallery images={GALLERY_IMAGES} flyImages={FLY_IMAGES} className="h-full w-full" />
        </div>
      </div>
    </main>
  );
}
