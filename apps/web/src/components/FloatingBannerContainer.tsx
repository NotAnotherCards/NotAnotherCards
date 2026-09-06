import * as React from 'react';

export function FloatingBannerContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const activeChildren = React.Children.toArray(children).filter(Boolean);

  if (activeChildren.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-none select-none flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
      {children}
    </div>
  );
}
