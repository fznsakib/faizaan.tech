import React from "react";
import styled from "@emotion/styled";
import Slider from "react-slick";

import Image from "gatsby-image";
import ImageDataHook from "../hooks/resumeurl";

const LanguageSlider = () => {
  const settings = {
    dots: true,
    infinite: true,
    speed: 1000,
    autoplaySpeed: 3000,
    fadeIn: false,
    autoplay: true,
    pauseOnHover: false,
    slidesToShow: 3,
    slidesToScroll: 1,
    responsive: [
      {
        breakpoint: 1000,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
          infinite: true,
          dots: true,
        },
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        },
      },
    ],
  };

  const data = ImageDataHook();

  // destructuring
  // const {
  //     pictures,
  // } = data;

  const StyledImage = styled(Image)`
    border-radius: 1rem;
    max-width: 80rem;
    margin: 0 auto;
    margin-bottom: 2rem;
  `;

  return (
    <Slider.ImageContainerSlider>
      <Slider {...settings}>
        {data.pictures.map((image, i) => (
          <Slider.SliderContainer2 key={i}>
            <StyledImage fluid={image.fluid} />
            <span>{image.description}</span>
          </Slider.SliderContainer2>
        ))}
      </Slider>
    </Slider.ImageContainerSlider>
  );
};

export default LanguageSlider;
