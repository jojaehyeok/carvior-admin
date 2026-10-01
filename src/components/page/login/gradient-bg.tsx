import React from "react";

interface IGradientBgProps {
  className?: string;
}

const GradientBg = ({ className }: IGradientBgProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="a" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#63489a">
            <animate
              attributeName="stop-color"
              values="#63489a;#4c3a7e;#8b7bb8;#b8bcc9;#63489a;"
              dur="40s"
              repeatCount="indefinite"
            ></animate>
          </stop>
          <stop offset=".5" stopColor="#8b7bb8">
            <animate
              attributeName="stop-color"
              values="#8b7bb8;#b8bcc9;#63489a;#4c3a7e;#8b7bb8;"
              dur="40s"
              repeatCount="indefinite"
            ></animate>
          </stop>
          <stop offset="1" stopColor="#4c3a7e">
            <animate
              attributeName="stop-color"
              values="#4c3a7e;#63489a;#b8bcc9;#8b7bb8;#4c3a7e;"
              dur="40s"
              repeatCount="indefinite"
            ></animate>
          </stop>
          <animateTransform
            attributeName="gradientTransform"
            type="rotate"
            from="0 .5 .5"
            to="360 .5 .5"
            dur="40s"
            repeatCount="indefinite"
          />
        </linearGradient>
        <linearGradient id="b" gradientUnits="objectBoundingBox" x1="0" y1="1" x2="1" y2="1">
          <stop offset="0" stopColor="#63489a">
            <animate
              attributeName="stop-color"
              values="#63489a;#4c3a7e;#8b7bb8;#b8bcc9;#63489a;"
              dur="40s"
              repeatCount="indefinite"
            ></animate>
          </stop>
          <stop offset="1" stopColor="#8b7bb8" stopOpacity="0">
            <animate
              attributeName="stop-color"
              values="#8b7bb8;#b8bcc9;#63489a;#4c3a7e;#8b7bb8;"
              dur="40s"
              repeatCount="indefinite"
            ></animate>
          </stop>
          <animateTransform
            attributeName="gradientTransform"
            type="rotate"
            values="360 .5 .5;0 .5 .5"
            dur="30s"
            repeatCount="indefinite"
          />
        </linearGradient>
      </defs>
      <rect fill="url(#a)" width="100%" height="100%" />
      <rect fill="url(#b)" width="100%" height="100%" />
    </svg>
  );
};

export default React.memo(GradientBg);
