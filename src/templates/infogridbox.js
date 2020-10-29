import React from "react";
import infoGridBoxStyles from "./infogridbox.module.scss"

export default function InfoGridBox(props) {
  return (
    <div className={infoGridBoxStyles.box}>
        <div className={infoGridBoxStyles.content}>
            <span className={infoGridBoxStyles.image} role="img">{props.image}</span>
            <p className={infoGridBoxStyles.header}>{props.header}</p>
            <p className={infoGridBoxStyles.text}>{props.text}</p>
        </div>
    </div>
  );
}
