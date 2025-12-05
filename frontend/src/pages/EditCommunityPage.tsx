import React, { useEffect, useState } from "react";
import { 
  Box, 
  CircularProgress, 
  Alert, 
  Tabs, 
  Tab, 
  Paper,
  Typography,
  Button,
  Container,
  Breadcrumbs,
  Link,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import {
  useGetCommunityByIdQuery,
  useUpdateCommunityMutation,
} from "../features/community/communityApiSlice";
import { useGetChannelsForCommunityQuery } from "../features/channel/channelApiSlice";
import { useCommunityForm } from "../hooks/useCommunityForm";
import { useUserPermissions } from "../features/roles/useUserPermissions";
import { useFileUpload } from "../hooks/useFileUpload";
import {
  CommunitySettingsForm,
  CommunityFormContent,
  MemberManagement,
  ChannelManagement,
  PrivateChannelMembership,
  RoleManagement,
} from "../components/Community";
import {
  BanListPanel,
  TimeoutListPanel,
  ModerationLogsPanel,
} from "../components/Moderation";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`community-tabpanel-${index}`}
      aria-labelledby={`community-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `community-tab-${index}`,
    'aria-controls': `community-tabpanel-${index}`,
  };
}

const Root = ({ children }: { children: React.ReactNode }) => (
  <Container maxWidth="lg" sx={{ py: 3 }}>
    {children}
  </Container>
);

const EditCommunityPage: React.FC = () => {
  const navigate = useNavigate();
  const { communityId } = useParams<{ communityId: string }>();
  const [tabValue, setTabValue] = useState(0);

  const {
    data: community,
    isLoading: isLoadingCommunity,
    error: communityError,
  } = useGetCommunityByIdQuery(communityId!);

  const {
    data: channels,
    isLoading: isLoadingChannels,
  } = useGetChannelsForCommunityQuery(communityId!, {
    skip: !communityId,
  });

  const [updateCommunity, { isLoading, error }] = useUpdateCommunityMutation();
  const { uploadFile, isUploading, error: uploadError } = useFileUpload();

  const { hasPermissions: canUpdateCommunity } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId!,
    actions: ["UPDATE_COMMUNITY"],
  });

  const { hasPermissions: canManageMembers } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId!,
    actions: ["READ_MEMBER"],
  });

  const { hasPermissions: canManageChannels } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId!,
    actions: ["CREATE_CHANNEL"],
  });

  const { hasPermissions: canViewModeration } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId!,
    actions: ["VIEW_BAN_LIST"],
  });

  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
    setFormData,
    setPreviewUrls,
  } = useCommunityForm();

  // Populate form when community data loads
  useEffect(() => {
    if (community) {
      setFormData({
        name: community.name || "",
        description: community.description || "",
        avatar: null, // Keep as null for file input
        banner: null, // Keep as null for file input
      });
      setPreviewUrls({
        avatar: community.avatar || null,
        banner: community.banner || null,
      });
    }
  }, [community, setFormData, setPreviewUrls]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm() || !communityId) {
      return;
    }

    try {
      // Upload avatar file if selected
      let avatarFileId: string | null = null;
      if (formData.avatar) {
        const uploadedAvatar = await uploadFile(formData.avatar, {
          resourceType: "COMMUNITY_AVATAR",
          resourceId: communityId,
        });
        avatarFileId = uploadedAvatar.id;
      }

      // Upload banner file if selected
      let bannerFileId: string | null = null;
      if (formData.banner) {
        const uploadedBanner = await uploadFile(formData.banner, {
          resourceType: "COMMUNITY_BANNER",
          resourceId: communityId,
        });
        bannerFileId = uploadedBanner.id;
      }

      // Update community with file IDs (or existing values if no new upload)
      const updateCommunityDto = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        avatar: avatarFileId || (community?.avatar ?? null),
        banner: bannerFileId || (community?.banner ?? null),
      };

      await updateCommunity({
        id: communityId,
        data: updateCommunityDto,
      }).unwrap();

      // Stay on the page after successful update
    } catch (err) {
      console.error("Failed to update community:", err);
    }
  };

  const handleGoBack = () => {
    navigate(`/community/${communityId}`);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (isLoadingCommunity || isLoadingChannels) {
    return (
      <Root>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Root>
    );
  }

  if (communityError || !community) {
    return (
      <Root>
        <Alert severity="error">
          Failed to load community. Please try again.
        </Alert>
      </Root>
    );
  }

  return (
    <Root>
      {/* Header */}
      <Box mb={3}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleGoBack}
            color="inherit"
          >
            Back to Community
          </Button>
        </Box>
        
        <Breadcrumbs>
          <Link 
            component="button" 
            variant="body1" 
            onClick={handleGoBack}
            sx={{ textDecoration: 'none' }}
          >
            {community.name}
          </Link>
          <Typography color="text.primary">Manage Community</Typography>
        </Breadcrumbs>
      </Box>

      {/* Tabs */}
      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="community management tabs">
            <Tab label="Settings" {...a11yProps(0)} disabled={!canUpdateCommunity} />
            <Tab label="Members" {...a11yProps(1)} disabled={!canManageMembers} />
            <Tab label="Channels" {...a11yProps(2)} disabled={!canManageChannels} />
            <Tab label="Private Channels" {...a11yProps(3)} disabled={!canManageChannels} />
            <Tab label="Roles" {...a11yProps(4)} />
            <Tab label="Moderation" {...a11yProps(5)} disabled={!canViewModeration} />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={tabValue} index={0}>
          {canUpdateCommunity ? (
            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              <CommunitySettingsForm
                onSubmit={handleSubmit}
                error={error || uploadError}
                errorMessage={
                  uploadError
                    ? `File upload failed: ${uploadError.message}`
                    : "Failed to update community. Please try again."
                }
                isLoading={isLoading || isUploading}
                isFormValid={formData.name.trim().length > 0}
                submitButtonText="Update Community"
                loadingText={isUploading ? "Uploading files..." : "Updating..."}
              >
                <CommunityFormContent
                  formData={formData}
                  previewUrls={previewUrls}
                  formErrors={formErrors}
                  onNameChange={handleInputChange("name")}
                  onDescriptionChange={handleInputChange("description")}
                  onAvatarChange={handleInputChange("avatar")}
                  onBannerChange={handleInputChange("banner")}
                />
              </CommunitySettingsForm>
            </div>
          ) : (
            <Alert severity="warning">
              You don't have permission to update community settings.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {canManageMembers ? (
            <MemberManagement communityId={communityId!} />
          ) : (
            <Alert severity="warning">
              You don't have permission to manage community members.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {canManageChannels ? (
            <ChannelManagement communityId={communityId!} />
          ) : (
            <Alert severity="warning">
              You don't have permission to manage channels.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {canManageChannels && channels ? (
            <PrivateChannelMembership 
              channels={channels}
              communityId={communityId!}
            />
          ) : canManageChannels ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          ) : (
            <Alert severity="warning">
              You don't have permission to manage private channel membership.
            </Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <RoleManagement communityId={communityId!} />
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          {canViewModeration ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                <Box sx={{ flex: "1 1 300px", minWidth: 300 }}>
                  <BanListPanel communityId={communityId!} />
                </Box>
                <Box sx={{ flex: "1 1 300px", minWidth: 300 }}>
                  <TimeoutListPanel communityId={communityId!} />
                </Box>
              </Box>
              <Box>
                <ModerationLogsPanel communityId={communityId!} />
              </Box>
            </Box>
          ) : (
            <Alert severity="warning">
              You don't have permission to view moderation tools.
            </Alert>
          )}
        </TabPanel>
      </Paper>
    </Root>
  );
};

export default EditCommunityPage;
