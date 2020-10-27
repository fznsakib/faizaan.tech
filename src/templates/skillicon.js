import React from "react";

import skillIconStyles from "./skillicon.module.scss"

export default function SkillIcon(props) {
  return (
    <div>
        <img className={props.name} src={props.publicURL} alt={props.name} />
        <div>props.name</div>
    </div>
  );
}
