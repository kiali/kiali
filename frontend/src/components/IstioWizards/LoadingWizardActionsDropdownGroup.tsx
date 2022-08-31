import { DropdownGroup, DropdownItem, Spinner } from "@patternfly/react-core";
import * as React from "react";

export function LoadingWizardActionsDropdownGroup() {
  return (
    <DropdownGroup key="wizards" label="Actions" className="kiali-group-menu">
      <DropdownItem isDisabled={true}>
        <Spinner isSVG={true} size="md" aria-label="Loading actions..." />
      </DropdownItem>
    </DropdownGroup>
  );
}
