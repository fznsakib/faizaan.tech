import React from "react";

import LanguageIcons from "../hooks/languageicons"
import SkillIcon from "../templates/skillicon"

import layoutStyles from "../components/layout.module.scss"
import skillGridStyles from "./skillgrid.module.scss"


export default function SkillGrid() {

    const languageIcons = LanguageIcons();

    console.log(languageIcons)

    return (
        <div className={skillGridStyles.container}>
            <div className={layoutStyles.row}>
                {languageIcons.map((language, i) => (
                    <div className={layoutStyles.column + " " + skillGridStyles.column} key={i}>
                        <SkillIcon name={language.node.name} publicURL={language.node.publicURL}></SkillIcon>
                    </div>
                ))}
            </div>
        </div>
            
    );
  }
  