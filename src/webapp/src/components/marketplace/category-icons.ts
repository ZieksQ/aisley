import type { IconType } from "react-icons";
import {
  LuArmchair,
  LuBaby,
  LuBookOpen,
  LuCar,
  LuGem,
  LuGrid2X2,
  LuHouse,
  LuMonitor,
  LuPawPrint,
  LuPencil,
  LuShirt,
  LuSparkles,
  LuUtensils,
  LuVolleyball,
} from "react-icons/lu";
import { PiDress } from "react-icons/pi";

const categoryIcons: Record<string, IconType> = {
  "pet-supplies": LuPawPrint,
  "electronics-and-gadgets": LuMonitor,
  "womens-apparel": PiDress,
  "mens-apparel": LuShirt,
  "kids-and-baby": LuBaby,
  "health-and-beauty": LuSparkles,
  "books-and-media": LuBookOpen,
  "food-and-gourmet": LuUtensils,
  "automotive-motorcycle-group-9": LuCar,
  "furniture-and-office-equipment": LuArmchair,
  "jewelry-and-watches": LuGem,
  "home-and-garden": LuHouse,
  "sports-and-outdoors": LuVolleyball,
  "office-and-school-supplies-group-12": LuPencil,
};

export function categoryIcon(slug: string): IconType {
  return categoryIcons[slug] ?? LuGrid2X2;
}
