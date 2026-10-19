// Small, generic food illustrations. These are decorations, not place photos.
export function FoodDoodle({
  kind = "dumpling",
  size = 72,
  className,
}: {
  kind?: "dumpling" | "skewer";
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {kind === "dumpling" ? (
        <>
          <path
            d="M10 48C11 31 23 21 40 21S69 31 70 48C67 63 13 65 10 48Z"
            fill="#FFE1A6"
            stroke="#332D29"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="m22 28 6 10m4-15 3 12m12-12-3 12m13-8-6 11"
            stroke="#C38C52"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <ellipse cx="29" cy="44" rx="2.4" ry="3.2" fill="#332D29" />
          <ellipse cx="51" cy="44" rx="2.4" ry="3.2" fill="#332D29" />
          <path
            d="M35 49q5 6 10 0"
            stroke="#332D29"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <ellipse cx="22" cy="49" rx="4" ry="2.5" fill="#F39A8D" />
          <ellipse cx="58" cy="49" rx="4" ry="2.5" fill="#F39A8D" />
          <path
            d="m65 13 1.5 5L72 20l-5.5 2-1.5 5-1.5-5L58 20l5.5-2Z"
            fill="#C4CF84"
            stroke="#332D29"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path
            d="m40 11 2 58"
            stroke="#332D29"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M27 16q-9 2-9 9t9 9q-9 2-9 9t9 9q-9 2-9 9 0 8 12 8h21q12 0 12-8 0-7-9-9 9-2 9-9t-9-9q9-2 9-9t-9-9Z"
            fill="#B9633E"
            stroke="#332D29"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M24 24q4 3 8 0m-8 18q4 3 8 0m16-18q4 3 8 0m-8 18q4 3 8 0M25 60q4 3 8 0m14 0q4 3 8 0"
            stroke="#F0BF77"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="34" cy="49" r="2" fill="#332D29" />
          <circle cx="46" cy="49" r="2" fill="#332D29" />
          <path
            d="M36 54q4 4 8 0"
            stroke="#332D29"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <ellipse cx="28" cy="54" rx="3" ry="2" fill="#F39A8D" />
          <ellipse cx="52" cy="54" rx="3" ry="2" fill="#F39A8D" />
        </>
      )}
    </svg>
  );
}
