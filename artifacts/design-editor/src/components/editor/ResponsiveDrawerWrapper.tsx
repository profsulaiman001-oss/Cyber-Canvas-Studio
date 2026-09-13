import { SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type ResponsiveDrawerWrapperProps = Omit<
  React.ComponentPropsWithoutRef<typeof SheetContent>,
  'side'
>;

/**
 * Shared layout wrapper for bottom sheets.
 *
 * Mobile keeps the existing full-width bottom-sheet layout. At the sm
 * breakpoint, the drawer becomes a centered floating panel so controls do not
 * stretch across desktop viewports.
 */
export function ResponsiveDrawerWrapper({
  className,
  children,
  ...props
}: ResponsiveDrawerWrapperProps) {
  return (
    <SheetContent
      side="bottom"
      className={cn(
        'w-full sm:max-w-2xl sm:mx-auto sm:left-0 sm:right-0 sm:bottom-4 sm:rounded-2xl sm:shadow-2xl',
        className,
      )}
      {...props}
    >
      {children}
    </SheetContent>
  );
}