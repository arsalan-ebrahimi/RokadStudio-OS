import React, { useState, useRef } from 'react';

export const StudioTiltLogo: React.FC = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('perspective(500px) rotateX(0deg) rotateY(0deg) scale(1)');
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -16;
    const rotateY = ((x - centerX) / centerX) * 16;

    setTransform(`perspective(500px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.06)`);
    setGlare({
      x: Math.round((x / rect.width) * 100),
      y: Math.round((y / rect.height) * 100),
      opacity: 0.35,
    });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(500px) rotateX(0deg) rotateY(0deg) scale(1)');
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="w-16 h-16 mx-auto rounded-2xl bg-[#612B89] p-3 shadow-hard cursor-pointer relative overflow-hidden transition-transform duration-150 ease-out select-none flex items-center justify-center border-2 border-[#3d1956]"
      style={{
        transform,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Specular Glare Reflection */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-200"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}) 0%, transparent 60%)`,
        }}
      />
      <img
        src="/rokad-sign.svg"
        alt="Rokad"
        className="w-full h-full object-contain filter invert drop-shadow-md pointer-events-none"
      />
    </div>
  );
};
