import type { SVGProps } from 'react';

export function BasketballIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M4.2 14.2C5.9 16.6 8.7 18 12 18s6.1-1.4 7.8-3.8" />
      <path d="M18 4.2c-1.9 1.9-3.9 4.2-5.5 6.3-1.6 2.1-2.6 4.6-3 7.3" />
      <path d="m6 4.2 8.5 11.8" />
      <path d="M2 10h20" />
    </svg>
  );
}
