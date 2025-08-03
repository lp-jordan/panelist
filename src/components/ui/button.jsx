import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '../../lib/utils'

const Button = React.forwardRef(
  ({ className = '', variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const variantClass = variant === 'ghost' ? 'btn-ghost' : 'btn-default'
    const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''
    return (
      <Comp
        className={cn('btn', variantClass, sizeClass, className)}
        ref={ref}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'

export { Button }
