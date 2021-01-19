import React from "react";

import projectTypeSelectorStyles from "./projecttypeselector.module.scss"

// Use props.state to change button styling
export default function ProjectTypeSelector(props) {
  return (
    <div className={projectTypeSelectorStyles.background}>
      <button 
      className={props.state ? `${projectTypeSelectorStyles.activeButton}` : `${projectTypeSelectorStyles.button}`} 
      onClick={props.trigger}
      disabled={props.state}
      >
          personal
      </button>
      <button 
      className={props.state ? `${projectTypeSelectorStyles.button}` : `${projectTypeSelectorStyles.activeButton}`} 
      onClick={props.trigger}
      disabled={!props.state}
      >
          work
      </button>
    </div>
  );
}