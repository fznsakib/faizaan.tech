import React, { useEffect, useRef, useState } from "react";

import { PixelIconContainer, PixelCanvas } from "./PixelIcon.styled";

interface PixelIconProps {
  imagePath: string;
  link: string;
  initialPixelSize?: number;
  steps?: number;
  animationDuration?: number;
  size?: number;
  alt?: string;
}

const PixelIcon: React.FC<PixelIconProps> = ({
  imagePath,
  link,
  initialPixelSize = 12,
  steps = 5,
  animationDuration = 400,
  size = 100,
  alt = "Pixelated icon",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = imagePath;
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
  }, [imagePath]);

  // Handle pixelation and animation
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Calculate the current pixel size based on hover state and animation step
    let pixelSize = initialPixelSize;

    if (isHovering) {
      // Calculate decreasing pixel size as steps progress
      pixelSize = Math.max(
        1,
        Math.floor(initialPixelSize * (1 - currentStep / steps))
      );
    } else if (isAnimatingOut) {
      // When animating out, increase pixel size back to initial
      pixelSize = Math.max(
        1,
        Math.floor(initialPixelSize * (currentStep / steps))
      );
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (pixelSize <= 1) {
      // If pixel size is 1 or less, render at full resolution
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      // Create a temporary canvas for pixelation
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      // Set temporary canvas size to a scaled-down version
      tempCanvas.width = Math.ceil(canvas.width / pixelSize);
      tempCanvas.height = Math.ceil(canvas.height / pixelSize);

      // Draw the image at a smaller size
      tempCtx.drawImage(
        imageRef.current,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height
      );

      // Draw the small image back to the main canvas at full size with pixelated rendering
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        tempCanvas,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }
  }, [
    imageLoaded,
    isHovering,
    isAnimatingOut,
    currentStep,
    initialPixelSize,
    steps,
    size,
  ]);

  // Animation controller
  useEffect(() => {
    if (isHovering) {
      setIsAnimatingOut(false);

      if (currentStep >= steps) return;

      const stepDuration = animationDuration / steps;
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, stepDuration);

      return () => clearTimeout(timer);
    } else if (isAnimatingOut) {
      if (currentStep <= 0) {
        setIsAnimatingOut(false);
        return;
      }

      const stepDuration = animationDuration / steps;
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev - 1);
      }, stepDuration);

      return () => clearTimeout(timer);
    }
  }, [isHovering, isAnimatingOut, currentStep, steps, animationDuration]);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (isAnimatingOut) {
      setIsAnimatingOut(false);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setIsAnimatingOut(true);
  };

  return (
    <PixelIconContainer
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ width: size, height: size }}
    >
      <PixelCanvas
        ref={canvasRef}
        width={size}
        height={size}
        aria-label={alt}
      />
    </PixelIconContainer>
  );
};

export default PixelIcon;
