import React from "react";

// Use props.state to change button styling
export default function ProjectGrid(props) {
  return (
    <div>
      <button onClick={props.trigger}>personal</button>
      <button onClick={props.trigger}>work</button>
    </div>
  );
}