import React from "react";

import LanguageIcons from "../hooks/languageicons";
import TechnologyIcons from "../hooks/technologyicons";
import SkillIcon from "../templates/skillicon";

import layoutStyles from "../components/layout.module.scss";
import skillGridStyles from "./skillgrid.module.scss";

export default function SkillGrid() {
  const languageIcons = LanguageIcons();
  const technologyIcons = TechnologyIcons();

  return (
    <div data-sal="zoom-out" data-sal-duration="1000" data-sal-easing="ease">
      <div className={skillGridStyles.container}>
        <div className={layoutStyles.row}>
          {languageIcons.map((language, i) => (
            <div
              className={
                layoutStyles.column + " " + skillGridStyles.languageColumn
              }
              key={i}
            >
              <SkillIcon
                name={language.node.name}
                publicURL={language.node.publicURL}
              ></SkillIcon>
            </div>
          ))}
        </div>
      </div>

      <div className={skillGridStyles.container}>
        <div className={layoutStyles.row}>
          {technologyIcons.map((technology, i) => (
            <div
              className={
                layoutStyles.column + " " + skillGridStyles.technologyColumn
              }
              key={i}
            >
              <SkillIcon
                name={technology.node.name}
                publicURL={technology.node.publicURL}
              ></SkillIcon>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
