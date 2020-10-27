import React from "react";
// import InfoGridBox from "../templates/infogridbox"

import layoutStyles from "../components/layout.module.scss"
import skillGridStyles from "./skillgrid.module.scss"

export default function SkillGrid() {
    return (
        <div className={skillGridStyles.container}>
            <div className={layoutStyles.row}>
                <div className={layoutStyles.column + " " + skillGridStyles.column}>
                    <p className={skillGridStyles.item}>hi</p>
                </div>
                <div className={layoutStyles.column + " " + skillGridStyles.column}>
                    <p className={skillGridStyles.item}>hi</p>
                </div>
                <div className={layoutStyles.column + " " + skillGridStyles.column}>
                    <p className={skillGridStyles.item}>hi</p>
                </div>
                <div className={layoutStyles.column + " " + skillGridStyles.column}>
                    <p className={skillGridStyles.item}>hi</p>
                </div>
            </div>
        </div>
            
    );
  }
  