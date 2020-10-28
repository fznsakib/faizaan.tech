import React from "react";

import skillIconStyles from "./skillicon.module.scss"

export default function SkillIcon(props) {
    var classMap = {
        'c++': skillIconStyles.cplusplus,
        'go': skillIconStyles.go,
        'javascript': skillIconStyles.javascript,
        'python': skillIconStyles.python
    }

    var languageMap = {
        'c++': 'C++',
        'go': 'Golang',
        'javascript': 'JavaScript',
        'python': 'Python'
    }
    
    var technologyMap = {
        'amazonwebservices': 'Amazon Web Services',
        'css3': 'CSS',
        'django': 'Django',
        'flask': 'Flask',
        'gatsbyjs': 'Gatsby.js',
        'git': 'Git',
        'graphql': 'GraphQL',
        'heroku': 'Heroku',
        'html5': 'HTML',
        'jupyter': 'Jupyter',
        'opencv': 'OpenCV',
        'pandas': 'Pandas',
        'pytorch': 'PyTorch',
        'sqlite': 'SQLite',
        'unity': 'Unity',
        'vuejs': 'Vue.js',
    }

    // Differentiate between language and technology grid
    const isLanguage = props.name in languageMap;
    const name = isLanguage ? languageMap[props.name] : technologyMap[props.name];
    var className = skillIconStyles.skill + " " + classMap[props.name];
    className += isLanguage ? " " + skillIconStyles.language : " " + skillIconStyles.technology;

    return (
        <div className={className}>
            <img src={props.publicURL} alt={props.name} />
            <div className={skillIconStyles.name}>{name}</div>
        </div>
    );
}
