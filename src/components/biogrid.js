import React from "react";

import BioGridBox from "../templates/biogridbox";
import BioInfo from "../hooks/bioinfo"

import bioGridStyles from "./biogrid.module.scss";

// reference: https://www.youtube.com/watch?v=icnZSJbNsEM

export default function BioGrid() {

    const bioInfo = BioInfo();

    return (
      <div className={bioGridStyles.container}>
          {bioInfo.map((info, i) => (
            <BioGridBox image={info.node.icon.file.url} header={info.node.title} body={info.node.body} alt={info.node.icon.title} key={i}></BioGridBox>
          ))}
      </div>
    );
  }
  