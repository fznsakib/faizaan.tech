import React from "react";

import skillIconStyles from "./skillicon.module.scss";

export default function SkillIcon(props) {
  const { name, url, isLanguage } = props;

  var classMap = {
    "c++": skillIconStyles.cplusplus,
    Go: skillIconStyles.go,
    javascript: skillIconStyles.javascript,
    python: skillIconStyles.python,
    graphql: skillIconStyles.graphql,
  };

  // Differentiate between language and technology grid
  var className = skillIconStyles.skill + " " + classMap[name];
  className += isLanguage
    ? " " + skillIconStyles.language
    : " " + skillIconStyles.technology;

  return (
    <div className={className}>
      <img src={url} alt={name} />
      <div className={skillIconStyles.name}>{name}</div>
    </div>
  );
}
