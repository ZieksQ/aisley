import React, { useState, useEffect } from 'react';
import type { Product } from '../../types/product';
import { Modal } from '../common/Modal';
import { useSeller } from '../../context/SellerContext';
import {
  FaPlus,
  FaXmark,
  FaCheck,
  FaLayerGroup,
} from 'react-icons/fa6';

interface ProductModalProps {
  product: Product | null; // null for add mode
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onSave,
}) => {
  const { storeSettings, addStoreCategory } = useSeller();

  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState(storeSettings.categories[0] || 'Apparel & Haute Couture');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState<number>(12000);
  const [compareAtPrice, setCompareAtPrice] = useState<number>(14000);
  const [costOfGoods, setCostOfGoods] = useState<number>(4500);
  const [stock, setStock] = useState<number>(10);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);
  const [imageUrl, setImageUrl] = useState(
    'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80'
  );

  // Variant chips
  const [sizes, setSizes] = useState<string[]>(['S', 'M', 'L']);
  const [newSize, setNewSize] = useState('');
  const [colors, setColors] = useState<string[]>(['Noir', 'Ivory']);
  const [newColor, setNewColor] = useState('');

  useEffect(() => {
    if (product) {
      setTitle(product.title);
      setSku(product.sku);
      setCategory(product.category);
      setDescription(product.description);
      setBasePrice(product.basePrice);
      setCompareAtPrice(product.compareAtPrice || 0);
      setCostOfGoods(product.costOfGoods);
      setStock(product.stock);
      setLowStockThreshold(product.lowStockThreshold);
      setImageUrl(product.imageUrl);
      setSizes(product.sizes || []);
      setColors(product.colors || []);
    } else {
      // Defaults for new product
      setTitle('');
      setSku(`MDT-ITM-${Math.floor(100 + Math.random() * 900)}`);
      setCategory(storeSettings.categories[0] || 'Apparel & Haute Couture');
      setDescription('');
      setBasePrice(8500);
      setCompareAtPrice(9500);
      setCostOfGoods(3200);
      setStock(15);
      setLowStockThreshold(5);
      setImageUrl('https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80');
      setSizes(['XS', 'S', 'M', 'L']);
      setColors(['Atelier Magenta', 'Obsidian Noir']);
    }
  }, [product, isOpen, storeSettings.categories]);

  const handleAddSize = () => {
    if (newSize.trim() && !sizes.includes(newSize.trim())) {
      setSizes([...sizes, newSize.trim()]);
      setNewSize('');
    }
  };

  const handleRemoveSize = (s: string) => {
    setSizes(sizes.filter((item) => item !== s));
  };

  const handleAddColor = () => {
    if (newColor.trim() && !colors.includes(newColor.trim())) {
      setColors([...colors, newColor.trim()]);
      setNewColor('');
    }
  };

  const handleRemoveColor = (c: string) => {
    setColors(colors.filter((item) => item !== c));
  };

  const handleAddNewCategory = () => {
    if (newCategoryInput.trim()) {
      addStoreCategory(newCategoryInput.trim());
      setCategory(newCategoryInput.trim());
      setNewCategoryInput('');
      setIsAddingCategory(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-generate variants from size/color combinations
    const generatedVariants = sizes.flatMap((s, sIdx) =>
      colors.map((c, cIdx) => ({
        id: `v-${sIdx}-${cIdx}`,
        name: `Size: ${s} / ${c}`,
        sku: `${sku}-${s}-${c.slice(0, 2).toUpperCase()}`,
        price: basePrice,
        stock: Math.max(1, Math.floor(stock / (sizes.length * colors.length || 1))),
      }))
    );

    onSave({
      title,
      sku,
      category,
      description,
      basePrice: Number(basePrice),
      compareAtPrice: Number(compareAtPrice) || undefined,
      costOfGoods: Number(costOfGoods),
      stock: Number(stock),
      lowStockThreshold: Number(lowStockThreshold),
      status: 'active',
      imageUrl,
      images: [imageUrl],
      variants: generatedVariants.length > 0 ? generatedVariants : [
        { id: 'v-default', name: 'Standard', sku, price: basePrice, stock },
      ],
      sizes,
      colors,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit Atelier Listing' : 'Create New Boutique Product'}
      subtitle="Publish artisanal creations to Aisley buyers with custom variant chips and COGS calculation."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        {/* Title & SKU */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Product Title <span className="text-[#E723A2]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sculpted Mulberry Silk Slip Gown"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Base SKU <span className="text-[#E723A2]">*</span>
            </label>
            <input
              type="text"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              placeholder="MDT-GWN-001"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono-num font-bold focus:ring-2 focus:ring-[#E723A2] focus:outline-none uppercase"
            />
          </div>
        </div>

        {/* Category Selector with Custom User Category Extension */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-bold uppercase tracking-wider text-slate-700">
              Atelier Category <span className="text-[#E723A2]">*</span>
            </label>
            {!isAddingCategory && (
              <button
                type="button"
                onClick={() => setIsAddingCategory(true)}
                className="text-[11px] font-bold text-[#E723A2] hover:underline flex items-center gap-1"
              >
                <FaPlus className="size-2.5" /> New Category
              </button>
            )}
          </div>

          {!isAddingCategory ? (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            >
              {storeSettings.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter custom atelier category name..."
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddNewCategory}
                className="px-4 py-2.5 rounded-xl bg-[#E723A2] text-white font-bold text-xs shrink-0"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsAddingCategory(false)}
                className="px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 shrink-0"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
            Artisanal Description & Craftsmanship Details
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe fabrication techniques, botanical dyeing processes, and garment care..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
          />
        </div>

        {/* Pricing & COGS Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Base Price (PHP ₱) <span className="text-[#E723A2]">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-black font-mono-num focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Compare-at Price (₱)
            </label>
            <input
              type="number"
              min={0}
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-black font-mono-num text-slate-500 focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
              <span>Cost of Goods (₱)</span>
              <span className="text-[10px] text-emerald-600 font-bold font-mono-num">
                Margin: {(((basePrice - costOfGoods) / (basePrice || 1)) * 100).toFixed(0)}%
              </span>
            </label>
            <input
              type="number"
              required
              min={0}
              value={costOfGoods}
              onChange={(e) => setCostOfGoods(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-black font-mono-num text-emerald-700 focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>
        </div>

        {/* Stock Levels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Total Inventory Quantity <span className="text-[#E723A2]">*</span>
            </label>
            <input
              type="number"
              required
              min={0}
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono-num font-bold focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
              Low Stock Warning Threshold
            </label>
            <input
              type="number"
              min={1}
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono-num font-bold focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>
        </div>

        {/* Size & Color Variant Chips */}
        <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200">
          <h4 className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <FaLayerGroup className="text-[#E723A2]" /> Variant Options & Attributes
          </h4>

          {/* Size Chips */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              Sizes / Dimensions Available:
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {sizes.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold font-mono-num"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => handleRemoveSize(s)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <FaXmark className="size-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                placeholder="e.g. XL or 42EU"
                className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
              />
              <button
                type="button"
                onClick={handleAddSize}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
              >
                + Add Size
              </button>
            </div>
          </div>

          {/* Color Chips */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
              Colors / Material Finishes Available:
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {colors.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FDF2F9] text-[#B50E77] border border-[#F9CFEA] text-xs font-bold"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => handleRemoveColor(c)}
                    className="text-[#B50E77] hover:text-rose-600"
                  >
                    <FaXmark className="size-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                placeholder="e.g. Raw Linen"
                className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
              />
              <button
                type="button"
                onClick={handleAddColor}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
              >
                + Add Color
              </button>
            </div>
          </div>
        </div>

        {/* Image URL preview */}
        <div>
          <label className="block font-bold uppercase tracking-wider text-slate-700 mb-1">
            Primary Lookbook Image URL
          </label>
          <div className="flex items-center gap-3">
            <input
              type="url"
              required
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Preview"
                className="size-12 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <FaCheck /> {product ? 'Save Changes' : 'Publish Product to Atelier'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
