import { FaStar } from 'react-icons/fa6'

export function ReviewRating({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="inline-flex items-center gap-1">
      <span aria-hidden="true" className="inline-flex gap-0.5 text-amber-500">
        {Array.from({ length: 5 }, (_, index) => (
          <FaStar className={index < rating ? '' : 'text-zinc-300 dark:text-zinc-600'} key={index} />
        ))}
      </span>
      <span className="text-sm font-medium">{rating}/5</span>
    </span>
  )
}
