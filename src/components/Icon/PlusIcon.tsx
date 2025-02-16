import React from "react";

type PlusIconProps = React.SVGProps<SVGSVGElement>;

const PlusIcon: React.FC<PlusIconProps> = ({ ...props }) => {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Vertical line */}
      <path d="M20 4 L20 36" />
      {/* Horizontal line */}
      <path d="M4 20 L36 20" />
    </svg>
  );
};

export default PlusIcon;
