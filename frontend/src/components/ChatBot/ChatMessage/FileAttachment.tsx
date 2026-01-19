import React from 'react';
import { ChatbotDisplayMode, FileDetailsLabel, PreviewAttachment } from '@patternfly/chatbot';
import { kialiStyle } from 'styles/StyleUtils';

type FileAttachmentProps = {
  code: string;
  displayMode: ChatbotDisplayMode;
  fileName: string;
};

const footerStyle = kialiStyle({
  display: 'none'
});

export const FileAttachment: React.FC<FileAttachmentProps> = ({ fileName, code, displayMode }) => {
  const [isPreviewModalOpen, setIsPreviewModalOpen] = React.useState<boolean>(false);

  const handlePreviewModalToggle = (_event: React.MouseEvent | MouseEvent | KeyboardEvent): void => {
    setIsPreviewModalOpen(!isPreviewModalOpen);
  };

  return (
    <div key={fileName}>
      <FileDetailsLabel fileName={fileName} onClick={handlePreviewModalToggle} />
      <PreviewAttachment
        code={code}
        fileName={fileName}
        displayMode={displayMode}
        handleModalToggle={handlePreviewModalToggle}
        isModalOpen={isPreviewModalOpen}
        onDismiss={() => null}
        onEdit={() => null}
        modalFooterClassName={footerStyle}
      />
    </div>
  );
};
