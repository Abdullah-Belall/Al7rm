import Image from "next/image";
import React from "react";
import shape from '@/public/images/shape/grid-01.svg'

export default function GridShape() {
  return (
    <>
      <div className="absolute right-0 top-0 -z-1 w-full max-w-[250px] xl:max-w-[450px]">
        <Image
          width={540}
          height={254}
          src={shape}
          alt="grid"
          unoptimized
          priority
        />
      </div>
      <div className="absolute bottom-0 left-0 -z-1 w-full max-w-[250px] rotate-180 xl:max-w-[450px]">
        <Image
          width={540}
          height={254}
          src={shape}
          alt="grid"
          unoptimized
          priority
        />
      </div>
    </>
  );
}
