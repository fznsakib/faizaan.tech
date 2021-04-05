import React from "react";

import Languages from "../hooks/languages";
import Technologies from "../hooks/technologies";
import SkillIcon from "../templates/skillicon";

import skillGridStyles from "./skillgrid.module.scss";

export default function SkillGrid() {
  const languages = Languages();
  const technologies = Technologies();

  return (
    <div data-sal="zoom-out" data-sal-duration="1000" data-sal-easing="ease">
      <div className={skillGridStyles.container}>
        <div className={skillGridStyles.row}>
          {languages.map((language, i) => (
            <div className={skillGridStyles.languageColumn} key={i}>
              <SkillIcon
                name={language.node.name}
                url={language.node.image.file.url}
                isLanguage={true}
              ></SkillIcon>
            </div>
          ))}
        </div>
      </div>

      <div className={skillGridStyles.container}>
        <div className={skillGridStyles.row}>
          {technologies.map((technology, i) => (
            <div className={skillGridStyles.technologyColumn} key={i}>
              <SkillIcon
                name={technology.node.name}
                url={technology.node.image.file.url}
                isLanguage={false}
              ></SkillIcon>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
