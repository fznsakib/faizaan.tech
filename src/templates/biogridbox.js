import React from "react";
import bioGridBoxStyles from "./biogridbox.module.scss"

export default function BioGridBox(props) {
  return (
    <div className={bioGridBoxStyles.box}>
        <div className={bioGridBoxStyles.content}>
            <span className={bioGridBoxStyles.image} role="img">{props.image}</span>
            <p className={bioGridBoxStyles.header}>{props.header}</p>
            <p className={bioGridBoxStyles.text}>{props.text}</p>
        </div>
    </div>
  );
}
