/**
 * Photos used as visual anchors where the page has no company photo of its own
 * (category cards, the top page, the question flow). Demo renders live in public/seed/.
 */
export const CATEGORY_PHOTO: Record<string, string> = {
  "exterior-paint": "/seed/exterior-1.jpg",
  kitchen: "/seed/kitchen-1.jpg",
  bath: "/seed/bath-1.jpg",
  interior: "/seed/interior-1.jpg",
  toilet: "/seed/bath-2.jpg",
  exterior: "/seed/garden-1.jpg",
  aircon: "/seed/aircon-1.jpg",
  "house-cleaning": "/seed/clean-1.jpg",
};

export const HERO_PHOTO = "/seed/interior-1.jpg";

export function categoryPhoto(slug: string | null | undefined): string {
  return (slug && CATEGORY_PHOTO[slug]) || HERO_PHOTO;
}
