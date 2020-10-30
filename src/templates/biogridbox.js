import React from "react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";

import bioGridBoxStyles from "./biogridbox.module.scss"

export default function BioGridBox(props) {
  return (
    <div className={bioGridBoxStyles.box}>
        <div className={bioGridBoxStyles.content}>
            <img className={bioGridBoxStyles.image} src={props.image} alt={props.alt} />
            <p className={bioGridBoxStyles.header}>{props.header}</p>
            <p className={bioGridBoxStyles.text}>{props.text}</p>
            {documentToReactComponents(
              props.body.json
            )}
        </div>
    </div>
  );
}
