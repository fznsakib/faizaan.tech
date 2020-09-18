import React from "react";
import nameBlockStyles from "./nameblock.module.scss";

export default function NameBlock(props) {
  return (
    <div className={nameBlockStyles.headers}>
        <h1 className={nameBlockStyles.name1}>faizaan sakib</h1>
        <h1 className={nameBlockStyles.name2}>faizaan sakib</h1>
        <h1 className={nameBlockStyles.name3}>faizaan sakib</h1>
        <h1 className={nameBlockStyles.name4}>faizaan sakib</h1>
        <h1 className={nameBlockStyles.jobTitle}>software engineer</h1>
    </div>
  );
}
