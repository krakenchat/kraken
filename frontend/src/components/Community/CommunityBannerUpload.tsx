import React from "react";
import { Box, Typography, styled } from "@mui/material";
import { Upload } from "@mui/icons-material";

const BannerSection = styled(Box)(({ theme }) => ({
  position: "relative",
  height: 200,
  borderRadius: theme.spacing(1),
  marginBottom: theme.spacing(3),
  border: `2px dashed ${theme.palette.divider}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  backgroundColor: theme.palette.background.default,
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

const BannerPreview = styled("img")({
  width: "100%",
  height: "100%",
  objectFit: "cover",
});

const BannerInput = styled("input")({
  display: "none",
});

interface CommunityBannerUploadProps {
  previewUrl: string | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const CommunityBannerUpload: React.FC<CommunityBannerUploadProps> = ({
  previewUrl,
  onChange,
}) => {
  return (
    <BannerSection>
      <BannerInput
        accept="image/*"
        id="banner-upload"
        type="file"
        onChange={onChange}
      />
      <label
        htmlFor="banner-upload"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {previewUrl ? (
          <BannerPreview src={previewUrl} alt="Banner preview" />
        ) : (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={1}
          >
            <Upload sx={{ fontSize: 48, color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary">
              Click to upload banner image
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Recommended: 600x200px
            </Typography>
          </Box>
        )}
      </label>
    </BannerSection>
  );
};

export default CommunityBannerUpload;
