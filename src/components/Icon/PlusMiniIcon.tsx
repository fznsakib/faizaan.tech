import React from "react";

type PlusMiniIconProps = React.SVGProps<SVGSVGElement>;

const PlusMiniIcon: React.FC<PlusMiniIconProps> = ({ ...props }) => {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Vertical line */}
      <path d="M20 15 L20 25" />
      {/* Horizontal line */}
      <path d="M15 20 L25 20" />
    </svg>
  );
};

export default PlusMiniIcon;
