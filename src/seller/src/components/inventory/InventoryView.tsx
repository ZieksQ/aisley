import React, { useState } from 'react';
import { useSeller } from '../../context/SellerContext';
import type { Product } from '../../types/product';
import { ProductModal } from './ProductModal';
import { Badge } from '../common/Badge';
import { formatPHP } from '../../utils/formatters';
import {
  FaPlus,
  FaMagnifyingGlass,
  FaPenToSquare,
  FaBoxArchive,
  FaTrash,
  FaBoxOpen,
} from 'react-icons/fa6';

export const InventoryView: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleArchiveProduct,
    storeSettings,
  } = useSeller();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'archived'>('all');

  // Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Filter products
  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === 'all' || prod.category === selectedCategory;
    const matchesSearch =
      prod.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prod.sku.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStock = true;
    if (stockStatusFilter === 'in_stock') {
      matchesStock = prod.stock > prod.lowStockThreshold && prod.status === 'active';
    } else if (stockStatusFilter === 'low_stock') {
      matchesStock = prod.stock <= prod.lowStockThreshold && prod.stock > 0 && prod.status === 'active';
    } else if (stockStatusFilter === 'out_of_stock') {
      matchesStock = prod.stock === 0 && prod.status === 'active';
    } else if (stockStatusFilter === 'archived') {
      matchesStock = prod.status === 'archived';
    }

    return matchesCategory && matchesSearch && matchesStock;
  });

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingProduct) {
      updateProduct(editingProduct.id, data);
    } else {
      addProduct(data);
    }
  };

  const getStockBadge = (stock: number, lowThreshold: number, status: string) => {
    if (status === 'archived') {
      return <Badge variant="neutral">Archived</Badge>;
    }
    if (stock === 0) {
      return <Badge variant="danger" dot>Out of Stock</Badge>;
    }
    if (stock <= lowThreshold) {
      return (
        <Badge variant="warning" dot>
          Low Stock ({stock})
        </Badge>
      );
    }
    return (
      <Badge variant="success">
        {stock} In Stock
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Add Product Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Product Catalog & Stock Inventory
          </h1>
          <p className="text-xs text-slate-500">
            Curate boutique product listings, manage sizes & colors, and monitor real-time stock levels.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-[#E723A2] hover:bg-[#D61590] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <FaPlus /> Add Product
        </button>
      </div>

      {/* Filters Bar */}
      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search */}
          <div className="sm:col-span-6 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <FaMagnifyingGlass className="size-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by title or SKU..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            >
              <option value="all">All Categories</option>
              {storeSettings.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#E723A2] focus:outline-none"
            >
              <option value="all">All Stock Statuses</option>
              <option value="in_stock">In Stock Only</option>
              <option value="low_stock">Low Stock Alerts</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="archived">Archived Items</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Catalog Table */}
      <div className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Product Details</th>
                <th className="py-3.5 px-4">Category & SKU</th>
                <th className="py-3.5 px-4">Retail Price (PHP)</th>
                <th className="py-3.5 px-4">COGS & Margin</th>
                <th className="py-3.5 px-4">Stock Level</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <FaBoxOpen className="size-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-bold text-sm text-slate-600">No products found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try modifying filters or add a new listing</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const marginPercent = (
                    ((product.basePrice - product.costOfGoods) / (product.basePrice || 1)) *
                    100
                  ).toFixed(0);

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition">
                      {/* Image & Title */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="size-12 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div className="max-w-[220px]">
                            <p className="font-bold text-slate-900 truncate">{product.title}</p>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {product.sizes?.map((s) => (
                                <span key={s} className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-mono-num">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category & SKU */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-800">{product.category}</p>
                        <p className="font-mono-num text-[11px] text-slate-400">{product.sku}</p>
                      </td>

                      {/* Retail Price */}
                      <td className="py-3.5 px-4">
                        <p className="font-black text-slate-900 font-mono-num text-sm">
                          {formatPHP(product.basePrice)}
                        </p>
                        {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
                          <p className="text-[10px] text-slate-400 line-through font-mono-num">
                            {formatPHP(product.compareAtPrice)}
                          </p>
                        )}
                      </td>

                      {/* COGS & Margin */}
                      <td className="py-3.5 px-4">
                        <p className="font-mono-num text-slate-700">{formatPHP(product.costOfGoods)}</p>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {marginPercent}% Margin
                        </span>
                      </td>

                      {/* Stock Level with Quick Adjust */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {getStockBadge(product.stock, product.lowStockThreshold, product.status)}
                          {product.status === 'active' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateProduct(product.id, { stock: Math.max(0, product.stock - 1) })}
                                className="size-5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 grid place-items-center font-bold cursor-pointer"
                                title="Decrease stock by 1"
                              >
                                -
                              </button>
                              <button
                                onClick={() => updateProduct(product.id, { stock: product.stock + 5 })}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] font-bold cursor-pointer"
                                title="Add 5 units"
                              >
                                +5
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                            title="Edit Product"
                          >
                            <FaPenToSquare className="size-3.5" />
                          </button>

                          <button
                            onClick={() => toggleArchiveProduct(product.id)}
                            className={`p-2 rounded-lg border transition cursor-pointer ${
                              product.status === 'archived'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title={product.status === 'archived' ? 'Unarchive Listing' : 'Archive Listing'}
                          >
                            <FaBoxArchive className="size-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`Delete "${product.title}"?`)) {
                                deleteProduct(product.id);
                              }
                            }}
                            className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Product"
                          >
                            <FaTrash className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Creator / Editor Modal */}
      <ProductModal
        product={editingProduct}
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSave={handleSaveProduct}
      />
    </div>
  );
};
