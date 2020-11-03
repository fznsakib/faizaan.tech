import React from "react";
import 'css-doodle';

const Doodle = props => {
  return <css-doodle>{`
          :doodle{
              // @grid: 30x45;
              @grid: 20x35;
              // @size: 20rem 100%;
              // @size: 1440px 815px;
              @size: 100% 100%;
              grid-gap: 5px;
              background: #F8C9CD;
              position: fixed;
              z-index: -100;
          }
          
          @random(0.4) { 
            border-top: 1px solid white; 
            opacity: @rand(0.2,0.4);
          }
          @random(0.4) { 
            border-left: 1px solid white;
            opacity: @rand(0.2,0.4);
          }

          background: rgba(221, 166, 170,  @rand(0, 0.25));
          transform: rotate(@p(±45deg));
          
        `}</css-doodle>
}

export default Doodle;
