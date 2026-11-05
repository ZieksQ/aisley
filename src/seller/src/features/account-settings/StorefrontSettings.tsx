import { AccountRemovalConfirmation, AccountSettingsFeedback } from "@aisley/ui/account-settings";
import { useState } from "react";
import { LuCamera, LuTrash2 } from 'react-icons/lu';
import { ShopCoverPreview } from '../../components/ShopCoverPreview';
import { FieldError, FormActions, inputClass, primaryButtonClass, sectionClass, TextField } from './fields';
import type { useAccountSettings } from './use-account-settings';
export function StorefrontSettings({ settings }: { settings: ReturnType<typeof useAccountSettings>; }) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const { account, storefront, setStorefront, shopCover, coverProgress, busy, errors, saveStorefront, chooseShopCover, uploadShopCover, removeShopCover } = settings;
  if (!account) return null;
  return <>
    <AccountSettingsFeedback error={["shop-cover", "storefront"].includes(settings.feedbackAction) ? settings.errors.form?.[0] ?? Object.values(settings.errors).flat()[0] : null} message={["shop-cover", "storefront"].includes(settings.feedbackAction) ? settings.message : null} />
    <section aria-labelledby="shop-cover-heading" className={sectionClass}>
      <h3 className="font-semibold" id="shop-cover-heading">Shop cover photo</h3>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Shown at the top of your public Shop page. JPEG, PNG, or WebP, smaller than 10 MB. The image is centered and may be cropped on some screens.</p>
      <div className="mt-4 max-w-3xl">
        <ShopCoverPreview coverUrl={account.shop.cover_url} file={shopCover} />
        <form className="mt-4" onSubmit={uploadShopCover}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5">
              <LuCamera />
              <span>Choose cover</span>
              <input
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={chooseShopCover}
                type="file"
              />
            </label>
            {shopCover ? <span className="max-w-56 truncate text-sm text-zinc-500">
              {shopCover.name}</span> : null}
            <button className={primaryButtonClass} disabled={!shopCover || busy !== null}>
              {busy === 'shop-cover' ? `Uploading ${coverProgress}%…` : 'Upload cover'}
            </button>
            {account.shop.cover_url ? <button
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-400/10"
              disabled={busy !== null}
              onClick={() => setConfirmingRemove(true)}
              type="button"
            >
              <LuTrash2 />Remove
            </button> : null}
          </div>
          {busy === 'shop-cover' ? <progress
            aria-label="Shop cover upload progress"
            className="mt-3 block h-2 w-full accent-[#4C1268]"
            max={100}
            value={coverProgress}
          /> : null}
          <FieldError errors={errors} name="photo" />
        </form>
      </div>
    </section>
    <form className="account-settings-form" onSubmit={saveStorefront}>
      <h3 className="font-semibold">Storefront information</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextField
          errors={errors}
          label="Shop name"
          name="name"
          onChange={(value) => setStorefront({ ...storefront, name: value })}
          required
          value={storefront.name}
        />
        <TextField
          errors={errors}
          label="Store contact email"
          name="contact_email"
          onChange={(value) => setStorefront({ ...storefront, contact_email: value })}
          type="email"
          value={storefront.contact_email}
        />
        <TextField
          errors={errors}
          label="Store contact number"
          name="contact_number"
          onChange={(value) => setStorefront({ ...storefront, contact_number: value })}
          value={storefront.contact_number}
        />
        <TextField
          errors={errors}
          label="Website"
          name="website"
          onChange={(value) => setStorefront({ ...storefront, website: value })}
          placeholder="https://"
          type="url"
          value={storefront.website}
        />
        <label className="text-sm font-medium sm:col-span-2">Description
          <textarea
            className={`${inputClass} min-h-28 py-3`}
            onChange={(event) => setStorefront({ ...storefront, description: event.target.value })}
            value={storefront.description}
          />
          <FieldError errors={errors} name="description" />
        </label>
        <label className="flex items-start gap-3 sm:col-span-2">
          <input
            checked={storefront.is_on_vacation}
            className="mt-1 size-4 accent-[#4C1268]"
            onChange={(event) => setStorefront({ ...storefront, is_on_vacation: event.target.checked })}
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-medium">Vacation mode</span>
            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">Prevents checkout from accepting products from this shop while enabled.</span>
          </span>
        </label>
        {storefront.is_on_vacation ? <label className="text-sm font-medium sm:col-span-2">Vacation message
          <span className="text-red-600">*</span>
          <textarea
            className={`${inputClass} min-h-24 py-3`}
            onChange={(event) => setStorefront({ ...storefront, vacation_message: event.target.value })}
            required
            value={storefront.vacation_message}
          />
          <FieldError errors={errors} name="vacation_message" />
        </label> : null}
      </div>
      <FormActions
        busy={busy === 'storefront'} disabled={busy !== null}
        label="Save storefront"
        progress="Saving…"
      />
    </form>
    {confirmingRemove ? <AccountRemovalConfirmation
      title="Remove Shop cover?"
      confirmLabel="Remove cover"
      destructive
      busy={busy === 'shop-cover'} confirmDisabled={busy !== null}
      onClose={() => setConfirmingRemove(false)}
      onConfirm={() => void removeShopCover().then(() => setConfirmingRemove(false))}
    >Your current Shop cover will be removed. You can upload another image later.
    </AccountRemovalConfirmation> : null}</>;
}
