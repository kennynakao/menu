export type HallSource = { id: string; name: string; url: string };

/** Every UC Davis dining location that publishes a dish-level menu. */
export const HALLS: HallSource[] = [
  {
    id: "segundo",
    name: "Segundo",
    url: "https://housing.ucdavis.edu/dining/dining-commons/segundo/",
  },
  {
    id: "tercero",
    name: "Tercero",
    url: "https://housing.ucdavis.edu/dining/dining-commons/tercero/",
  },
  {
    id: "cuarto",
    name: "Cuarto",
    url: "https://housing.ucdavis.edu/dining/dining-commons/cuarto/",
  },
  {
    id: "latitude",
    name: "Latitude",
    url: "https://housing.ucdavis.edu/dining/latitude/",
  },
];
