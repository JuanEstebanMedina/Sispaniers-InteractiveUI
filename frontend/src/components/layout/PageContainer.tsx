import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  wide?: boolean
}

export function PageContainer({ className, wide, ...props }: PageContainerProps) {
  return (
    <div className={cn('px-4 pb-page sm:px-gutter', className)}>
      <div className={cn('w-full', !wide && 'mx-auto max-w-content-wide')} {...props} />
    </div>
  )
}
