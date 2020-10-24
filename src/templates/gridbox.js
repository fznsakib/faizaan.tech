import React from "react";
import gridboxStyles from "./gridbox.module.scss"

export default function GridBox(props) {
  return (
    <div className={gridboxStyles.box}>
        <div className={gridboxStyles.content}>
            <span className={gridboxStyles.image} role="img">{props.image}</span>
            <p className={gridboxStyles.header}>{props.header}</p>
            <p className={gridboxStyles.text}>{props.text}</p>
        </div>
    </div>
  );
}
