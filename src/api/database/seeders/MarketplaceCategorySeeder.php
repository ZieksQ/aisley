<?php

namespace Database\Seeders;

use App\Enums\CategoryStatus;
use App\Models\Category;
use App\Models\ShopCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MarketplaceCategorySeeder extends Seeder
{
    /** @var array<string, list<string>> */
    private const TAXONOMY = [
        'Pet Supplies' => ['Dog Food & Treats', 'Cat Litter & Accessories', 'Aquariums & Fish Supplies', 'Bird Feeders & Food', 'Pet Grooming Products', 'Pet Health & Wellness'],
        'Electronics and Gadgets' => ['Mobile Phones & Accessories', 'Laptops, Desktops & Monitors', 'Audio & Video Equipment', 'Smart Home Devices', 'Cameras & Photography', 'Wearable Technology'],
        "Women's Apparel" => ['Dresses & Skirts', 'Tops & Blouses', 'Activewear & Yoga Pants', 'Lingerie & Sleepwear', 'Jackets & Coats', 'Shoes & Accessories'],
        "Men's Apparel" => ['Suits & Blazers', 'Casual Shirts & Pants', 'Outerwear & Jackets', 'Activewear & Fitness Gear', 'Shoes & Accessories', 'Grooming Products'],
        'Kids and Baby' => ['Baby Clothes & Accessories', 'Toys & Games', 'Educational Materials', 'Strollers & Gear', 'Nursery Furniture', 'Safety and Health'],
        'Health and Beauty' => ['Makeup & Cosmetics', 'Personal Care Appliances', "Men's Grooming", 'Health Supplements', 'Skincare Products', 'Haircare Solutions'],
        'Books and Media' => ['Fiction & Non-Fiction Books', 'Magazines & Periodicals', 'Music CDs & Vinyl Records', 'Movie DVDs & Blu-ray', 'Video Games & Consoles', 'Educational DVDs'],
        'Food and Gourmet' => ['Baking Supplies & Ingredients', 'Coffee, Tea & Beverages', 'Snacks & Candy', 'Specialty Foods & International Cuisine', 'Organic and Health Foods', 'Meal Kits & Prepped Foods'],
        'Automotive & Motorcycle - Group 9' => ['Protective Gear', 'Maintenance & Repair Tools', 'Parts & Accessories', 'Electrical Components', 'Tires, Wheels, and Fluids'],
        'Furniture and Office Equipment' => ['Office Desks & Chairs', 'Storage Cabinets & Shelving', 'Conference & Meeting Furniture', 'Computer Tables & Workstations', 'Ergonomic Accessories', 'Office Lighting & Fixtures'],
        'Jewelry and Watches' => ['Watches for Men & Women', 'Necklaces & Pendants', 'Rings & Earrings', 'Bracelets & Bangles', 'Fashion Jewelry', 'Jewelry Storage & Care'],
        'Home and Garden' => ['Kitchen Appliances', 'Furniture & Decor', 'Gardening Tools', 'Outdoor Living', 'Home Improvement Tools', 'Bedding & Bath'],
        'Sports and Outdoors' => ['Fitness Equipment', 'Camping & Hiking Gear', 'Sports Apparel', 'Cycling & Bikes', 'Water Sports', 'Team Sports Equipment'],
        'Office and School Supplies - Group 12' => ['Notebooks & Paper Products', 'Writing Instruments', 'Office Furniture', 'Printers & Printing Supplies', 'School Bags & Backpacks', 'Arts & Craft Materials'],
    ];

    public function run(): void
    {
        DB::transaction(function (): void {
            foreach (array_keys(self::TAXONOMY) as $shopPosition => $shopCategoryName) {
                $productCategoryNames = self::TAXONOMY[$shopCategoryName];
                $shopCategorySlug = Str::slug($shopCategoryName);
                $shopCategory = ShopCategory::query()->updateOrCreate(
                    ['slug' => $shopCategorySlug],
                    ['name' => $shopCategoryName, 'status' => CategoryStatus::Active, 'position' => $shopPosition],
                );

                foreach ($productCategoryNames as $productPosition => $productCategoryName) {
                    Category::query()->updateOrCreate(
                        ['slug' => $shopCategorySlug.'-'.Str::slug($productCategoryName)],
                        [
                            'shop_category_id' => $shopCategory->id,
                            'parent_id' => null,
                            'name' => $productCategoryName,
                            'status' => CategoryStatus::Active,
                            'position' => $productPosition,
                        ],
                    );
                }
            }
        });
    }
}
