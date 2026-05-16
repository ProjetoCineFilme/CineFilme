'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
}

const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };

export default function StarRating({ value, onChange, size = 'md', readonly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div
      className="flex gap-0.5"
      onMouseLeave={() => !readonly && setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const leftVal = star - 0.5;
        const filled = display >= star;
        const half = !filled && display >= leftVal;
        const cls = sizeMap[size];

        return (
          <div key={star} className={`relative ${cls} flex-shrink-0`}>
            {/* empty background star */}
            <Star className={`${cls} text-neutral-200`} />

            {/* filled / half-filled overlay */}
            {(filled || half) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: half ? '50%' : '100%' }}
              >
                <Star className={`${cls} text-amber-400 fill-amber-400`} />
              </div>
            )}

            {/* click zones — left half = n-0.5, right half = n */}
            {!readonly && onChange && (
              <>
                <button
                  className="absolute left-0 top-0 w-1/2 h-full cursor-pointer"
                  onMouseEnter={() => setHovered(leftVal)}
                  onClick={() => onChange(leftVal)}
                  aria-label={`${leftVal} estrelas`}
                />
                <button
                  className="absolute right-0 top-0 w-1/2 h-full cursor-pointer"
                  onMouseEnter={() => setHovered(star)}
                  onClick={() => onChange(star)}
                  aria-label={`${star} estrelas`}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
