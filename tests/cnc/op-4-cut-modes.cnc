=   http://www.cimco-software.com/namespace/nc/format/compact-nci    
   ?   http://www.cimco-software.com/namespace/nc/parameter/product-id	   fusion360   A   http://www.cimco-software.com/namespace/nc/parameter/generated-by   F u s i o n   3 6 0   C A M   2 . 0 . 1 5 0 5 0    A   http://www.cimco-software.com/namespace/nc/parameter/generated-at%   S a t u r d a y ,   J a n u a r y   1 4 ,   2 0 2 3   6 : 2 2 : 2 8   P M    =   http://www.cimco-software.com/namespace/nc/parameter/hostname   D E S K T O P - 8 F U G 9 2 U    =   http://www.cimco-software.com/namespace/nc/parameter/username   c h r i s    B   http://www.cimco-software.com/namespace/nc/parameter/document-path   o p - 4 - c u t - m o d e s   v 2    @   http://www.cimco-software.com/namespace/nc/parameter/document-id$   9 3 5 f 1 e c c - 4 9 4 c - 4 1 9 8 - 9 5 5 6 - 3 f a a 2 b 3 0 7 3 e 5    B   http://www.cimco-software.com/namespace/nc/parameter/model-version$   a f 7 9 5 1 b 6 - 5 c f e - 4 4 6 a - a 3 3 2 - 3 3 a 5 3 8 b 9 5 0 d 0       ncprogram-id         leads-supported      D   http://www.cimco-software.com/namespace/nc/parameter/job-description   S e t u p 1    ?   http://www.cimco-software.com/namespace/nc/parameter/machine-id   2 
   
   machine-v2�  {
   "controller" : {
      "default" : {
         "max_block_processing_speed" : 0,
         "max_normal_speed" : 0,
         "parts" : {
            "linear_0" : {
               "max_normal_speed" : 0,
               "max_rapid_speed" : 0,
               "preference" : "negative",
               "reset" : "never",
               "reversed" : false,
               "tcp" : false,
               "zero_position_offset" : 0
            },
            "linear_1" : {
               "max_normal_speed" : 0,
               "max_rapid_speed" : 0,
               "preference" : "no preference",
               "reset" : "never",
               "reversed" : false,
               "tcp" : true,
               "zero_position_offset" : 0
            },
            "linear_2" : {
               "max_normal_speed" : 0,
               "max_rapid_speed" : 0,
               "preference" : "no preference",
               "reset" : "never",
               "reversed" : false,
               "tcp" : true,
               "zero_position_offset" : 0
            }
         }
      }
   },
   "general" : {
      "capabilities" : [ "cutting" ],
      "description" : "LightBurn post-processor",
      "minimumRevision" : 45805,
      "model" : "LaserPost for LightBurn",
      "vendor" : "nuCarve"
   },
   "kinematics" : {
      "default" : {
         "conventions" : {
            "rotation" : "right-handed"
         },
         "parts" : [
            {
               "control" : "driven",
               "direction" : [ -1, 0, 0 ],
               "id" : "linear_0",
               "name" : "X",
               "parts" : [
                  {
                     "control" : "driven",
                     "direction" : [ 0, -1, 0 ],
                     "id" : "linear_1",
                     "name" : "Y",
                     "parts" : [
                        {
                           "control" : "driven",
                           "direction" : [ 0, 0, -1 ],
                           "id" : "linear_2",
                           "name" : "Z",
                           "parts" : [
                              {
                                 "attach_frame" : {
                                    "point" : [ 0, 0, 0 ],
                                    "x_direction" : [ 1, 0, 0 ],
                                    "z_direction" : [ 0, 0, 1 ]
                                 },
                                 "display_name" : "table",
                                 "id" : "table",
                                 "type" : "table"
                              }
                           ],
                           "type" : "linear"
                        }
                     ],
                     "type" : "linear"
                  }
               ],
               "type" : "linear"
            },
            {
               "attach_frame" : {
                  "point" : [ 0, 0, 0 ],
                  "x_direction" : [ 1, 0, 0 ],
                  "z_direction" : [ 0, 0, 1 ]
               },
               "display_name" : "head",
               "id" : "head",
               "spindle" : {
                  "max_speed" : 0,
                  "min_speed" : 0
               },
               "tool_station" : {
                  "coolants" : null,
                  "max_tool_diameter" : 0,
                  "max_tool_length" : 0
               },
               "type" : "head"
            }
         ],
         "units" : {
            "angle" : "degrees",
            "length" : "mm"
         }
      }
   },
   "machining" : {
      "default" : {
         "feedrate_ratio" : 1,
         "tool_change_time" : 15
      }
   },
   "post" : {
      "default" : {
         "output_folder" : "C:\\Users\\chris\\Downloads",
         "path" : "cloud://laserpost-lightburn.cps",
         "properties" : {
            "machine0050Orientation" : "top-right",
            "machine0100SpeedUnits" : "mmps",
            "machine0300AutomaticUpdate" : "daily",
            "machine0400UpdateAllowBeta" : false,
            "machine0500ShuttleLaser1" : "55",
            "machine0600ShuttleLaser2" : ""
         }
      }
   },
   "tooling" : {
      "default" : {
         "has_tool_changer" : true,
         "number_of_tools" : 100,
         "supports_tool_preload" : true
      }
   }
}

   ?   http://www.cimco-software.com/namespace/nc/parameter/stock-type   b o x       kind   
   :   http://www.cimco-software.com/namespace/nc/parameter/stock   ((0, 0, -1), (202, 202, 0))             ��  JC  JC          kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-lower-x              kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-lower-y              kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-lower-z      �      kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-upper-x     @i@      kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-upper-y     @i@      kind      B   http://www.cimco-software.com/namespace/nc/parameter/stock-upper-z        �     PartReference   ModelCS                              �?       �                              �?�     TableAttach	   MachineCS                              �?       �                              �?�     UserTableAttach   TableAttach                              �?                                      �?   1   http://www.cimco-software.com/namespace/nc/marker       :   http://www.cimco-software.com/namespace/nc/parameter/notes    
   G   http://www.cimco-software.com/namespace/nc/parameter/operation-strategy   jet2d   F   http://www.cimco-software.com/namespace/nc/parameter/operation-comment   O u t e r   t h r o u g h       autodeskcam:operation-id         leads-supported         autodeskcam:path   S e t u p s \ S e t u p 1 \ O u t e r   t h r o u g h       operation:is2DStrategy         operation:is3DStrategy          operation:isRoughingStrategy          operation:isFinishingStrategy         operation:isMillingStrategy          operation:isTurningStrategy          operation:isJetStrategy         operation:isAdditiveStrategy          operation:isProbingStrategy          operation:isInspectionStrategy          operation:isDrillingStrategy          operation:isHoleMillingStrategy          operation:isThreadStrategy          operation:isSamplingStrategy          operation:isRotaryStrategy       $   operation:isSecondarySpindleStrategy          operation:isSurfaceStrategy           operation:isCheckSurfaceStrategy          operation:isMultiAxisStrategy          operation:advancedMode          operation:betaMode          operation:alphaMode          operation:isXpress          operation:licenseMultiaxis         operation:license3D         operation:metric         operation:isAssemblyDocument   
      operation:context	   operation
      operation:strategy   jet2d
      operation:operation_description    
      operation:tool_type   laser cutter      operation:tool_isTurning          operation:tool_isMill          operation:tool_isDrill          operation:tool_isJet         operation:tool_isDepositing    
      operation:tool_unit   millimeters      operation:tool_number         operation:tool_diameterOffset   
      operation:tool_description   Acrylic - CO2 glass
      operation:tool_comment    
      operation:tool_vendor    
      operation:tool_productId          kind         operation:tool_segmentHeight      $@      kind      #   operation:tool_segmentDiameterLower      $@      kind      #   operation:tool_segmentDiameterUpper      $@      kind      !   operation:tool_shaftSegmentHeight      �?      kind      (   operation:tool_shaftSegmentDiameterLower      �?      kind      (   operation:tool_shaftSegmentDiameterUpper      �?      kind         operation:tool_kerfWidth�������?      kind         operation:tool_nozzleDiameter�������?      kind         operation:tool_headClearance      �?
   $   operation:tool_machineQualityControl   manual      operation:holder_attached    
      operation:holder_description    
      operation:holder_comment    
      operation:holder_vendor    
      operation:holder_productId    
      operation:holder_productLink    
      operation:holder_libraryName    
      operation:tool_productLink    
      operation:cuttingMode   auto      kind         operation:kerfWidth�������?
      operation:machineQualityControl   manual      kind         operation:tool_feedCutting      �@      kind         operation:tool_feedEntry      �@      kind         operation:tool_feedExit      �@
      operation:featureOperationId   none      kind         operation:surfaceZHigh      �      kind         operation:surfaceZLow      �      kind         operation:surfaceXLow      �?      kind         operation:surfaceXHigh      i@      kind         operation:surfaceYLow      �?      kind         operation:surfaceYHigh      i@      kind         operation:stockZHigh              kind         operation:stockZLow      �      kind         operation:stockXLow              kind         operation:stockXHigh     @i@      kind         operation:stockYLow              kind         operation:stockYHigh     @i@      operation:selectCoPlanarFaces    
      operation:contours_loops   all
      operation:contours_side   start-outside      kind         operation:tabWidth      @
      operation:tabPositioning   distance
      operation:tabApproach   contour      operation:tabsPerContour         kind         operation:tabDistance      I@
      operation:clearanceHeight_mode   from retract height      kind          operation:clearanceHeight_offset      $@      kind         operation:clearanceHeight_value      .@   "   operation:clearanceHeight_absolute   
      operation:retractHeight_mode   from stock top      kind         operation:retractHeight_offset      @      kind         operation:retractHeight_value      @       operation:retractHeight_absolute   
      operation:topHeight_mode   from stock top      kind         operation:topHeight_offset              kind         operation:topHeight_value              operation:topHeight_absolute         kind         operation:tolerance{�G�z�?      kind         operation:contourTolerance{�G�zt?      kind         operation:calculationTolerance{�G�z�?      kind         operation:chainingTolerance{�G�z�?      kind         operation:gougingTolerance{�G�z�?
      operation:compensation   left
      operation:compensationType   computer      kind         operation:finishingOverlap        
      operation:cornerMode   roll      operation:preserveOrder          operation:bothWaysJL          kind         operation:stockToLeave              kind      "   operation:smoothingFilterTolerance              kind         operation:reducedFeedChange      9@      kind         operation:reducedFeedRadius              kind         operation:reducedFeedDistance              kind         operation:reducedFeedrate      |@       operation:reduceOnlyInnerCorners          operation:keepToolDown          kind         operation:stayDownDistance              kind      "   operation:minimumStayDownClearance              kind      $   operation:minimumStayDownClearanceJl           "   operation:forceRetractForInsideCut          kind         operation:noEngagementFeedrate      �@      operation:doLeadIn   
      operation:entry_style   smooth      kind         operation:entry_radius              kind         operation:entry_sweep      N@      kind         operation:entry_distance      �?      kind         operation:leadInRadius              operation:doLeadOut         operation:exit_sameAsEntry   
      operation:exit_style   smooth      kind         operation:exit_radius              kind         operation:exit_sweep      N@      kind         operation:exit_distance      �?      kind         operation:leadOutRadius              kind         operation:pierceClearance�������?      kind         operation:tool_cutHeight      �?      kind         operation:tool_cutPower      T@      kind         operation:tool_pierceHeight      @      kind         operation:tool_pierceTime      �?      kind         operation:tool_piercePower      T@
      operation:tool_assistGas   on      kind         operation:tool_pressure      �?      kind         operation:tool_abrasiveFlowRate      �?
   '   operation_post_property:op0100LayerMode   inherit
   $   operation_post_property:op0200UseAir   gas
   )   operation_post_property:op0300LaserEnable   laser2      kind      (   operation_post_property:op0400PowerScale      Y@      kind      %   operation_post_property:op0500ZOffset              kind      $   operation_post_property:op0600Passes      �?      kind      #   operation_post_property:op0700ZStep        
   '   operation_post_property:op0800GroupName    
   1   operation_post_property:op0900CustomCutSettingXML    
              ��  ��  �?  �?              �?              �?  ��  ��  �?  �?              �?              �?             �                                                              �������?�������?      �?      @              �?      �?              T@      T@   o n    m a n u a l    1                                                                                                                                                        pΘ@�@��Ao�?��A    33KA\�"@33KA    33�A$�A  �A33�A  �A   X   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-description   A c r y l i c   -   C O 2   g l a s s    T   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-comment       S   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-vendor       W   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-product-id       _   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-description       [   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-comment       Z   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-vendor       ^   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-product-id          movement:lead_in      �@      movement:cutting      �@      movement:lead_out      �@      movement:transition      �@      movement:direct      �@      movement:helix_ramp      �@      movement:profile_ramp      �@      movement:zigzag_ramp      �@      movement:ramp      �@      movement:plunge              movement:predrill      �@      movement:extended      �@      movement:reduced      �@      movement:finish_cutting      �@      movement:high_feed              movement:depositing                       e   Y�HC ��B  pA    e   Y�HC ��B        �      
      action   pierced   3�HC  �B      �D   n   �$B��4C      �B  �B              �?  �D  n   �$B�Q�A      �B  �B              �?  �D   n   3�HC  �B      �B  �B              �?  �D  d   Y�HC ��B      �D   �      e   Y�HC ��B  pA          1   http://www.cimco-software.com/namespace/nc/marker       :   http://www.cimco-software.com/namespace/nc/parameter/notes    
   G   http://www.cimco-software.com/namespace/nc/parameter/operation-strategy   jet2d   F   http://www.cimco-software.com/namespace/nc/parameter/operation-comment   C e n t e r   t h r o u g h       autodeskcam:operation-id         leads-supported         autodeskcam:path   S e t u p s \ S e t u p 1 \ C e n t e r   t h r o u g h       operation:is2DStrategy         operation:is3DStrategy          operation:isRoughingStrategy          operation:isFinishingStrategy         operation:isMillingStrategy          operation:isTurningStrategy          operation:isJetStrategy         operation:isAdditiveStrategy          operation:isProbingStrategy          operation:isInspectionStrategy          operation:isDrillingStrategy          operation:isHoleMillingStrategy          operation:isThreadStrategy          operation:isSamplingStrategy          operation:isRotaryStrategy       $   operation:isSecondarySpindleStrategy          operation:isSurfaceStrategy           operation:isCheckSurfaceStrategy          operation:isMultiAxisStrategy          operation:advancedMode          operation:betaMode          operation:alphaMode          operation:isXpress          operation:licenseMultiaxis         operation:license3D         operation:metric         operation:isAssemblyDocument   
      operation:context	   operation
      operation:strategy   jet2d
      operation:operation_description    
      operation:tool_type   laser cutter      operation:tool_isTurning          operation:tool_isMill          operation:tool_isDrill          operation:tool_isJet         operation:tool_isDepositing    
      operation:tool_unit   millimeters      operation:tool_number         operation:tool_diameterOffset   
      operation:tool_description   Acrylic - CO2 glass
      operation:tool_comment    
      operation:tool_vendor    
      operation:tool_productId          kind         operation:tool_segmentHeight      $@      kind      #   operation:tool_segmentDiameterLower      $@      kind      #   operation:tool_segmentDiameterUpper      $@      kind      !   operation:tool_shaftSegmentHeight      �?      kind      (   operation:tool_shaftSegmentDiameterLower      �?      kind      (   operation:tool_shaftSegmentDiameterUpper      �?      kind         operation:tool_kerfWidth�������?      kind         operation:tool_nozzleDiameter�������?      kind         operation:tool_headClearance      �?
   $   operation:tool_machineQualityControl   manual      operation:holder_attached    
      operation:holder_description    
      operation:holder_comment    
      operation:holder_vendor    
      operation:holder_productId    
      operation:holder_productLink    
      operation:holder_libraryName    
      operation:tool_productLink    
      operation:cuttingMode   auto      kind         operation:kerfWidth�������?
      operation:machineQualityControl   manual      kind         operation:tool_feedCutting      �@      kind         operation:tool_feedEntry      �@      kind         operation:tool_feedExit      �@
      operation:featureOperationId   none      kind         operation:surfaceZHigh      �      kind         operation:surfaceZLow      �      kind         operation:surfaceXLow      �?      kind         operation:surfaceXHigh      i@      kind         operation:surfaceYLow      �?      kind         operation:surfaceYHigh      i@      kind         operation:stockZHigh              kind         operation:stockZLow      �      kind         operation:stockXLow              kind         operation:stockXHigh     @i@      kind         operation:stockYLow              kind         operation:stockYHigh     @i@      operation:selectCoPlanarFaces    
      operation:contours_loops   all
      operation:contours_side   start-outside      kind         operation:tabWidth      @
      operation:tabPositioning   distance
      operation:tabApproach   contour      operation:tabsPerContour         kind         operation:tabDistance      I@
      operation:clearanceHeight_mode   from retract height      kind          operation:clearanceHeight_offset      $@      kind         operation:clearanceHeight_value      .@   "   operation:clearanceHeight_absolute   
      operation:retractHeight_mode   from stock top      kind         operation:retractHeight_offset      @      kind         operation:retractHeight_value      @       operation:retractHeight_absolute   
      operation:topHeight_mode   from stock top      kind         operation:topHeight_offset              kind         operation:topHeight_value              operation:topHeight_absolute         kind         operation:tolerance{�G�z�?      kind         operation:contourTolerance{�G�zt?      kind         operation:calculationTolerance{�G�z�?      kind         operation:chainingTolerance{�G�z�?      kind         operation:gougingTolerance{�G�z�?
      operation:compensation   left
      operation:compensationType   computer      kind         operation:finishingOverlap        
      operation:cornerMode   roll      operation:preserveOrder          operation:bothWaysJL          kind         operation:stockToLeave              kind      "   operation:smoothingFilterTolerance              kind         operation:reducedFeedChange      9@      kind         operation:reducedFeedRadius              kind         operation:reducedFeedDistance              kind         operation:reducedFeedrate      |@       operation:reduceOnlyInnerCorners          operation:keepToolDown          kind         operation:stayDownDistance              kind      "   operation:minimumStayDownClearance              kind      $   operation:minimumStayDownClearanceJl           "   operation:forceRetractForInsideCut          kind         operation:noEngagementFeedrate      �@      operation:doLeadIn   
      operation:entry_style   smooth      kind         operation:entry_radius              kind         operation:entry_sweep      N@      kind         operation:entry_distance      �?      kind         operation:leadInRadius              operation:doLeadOut         operation:exit_sameAsEntry   
      operation:exit_style   smooth      kind         operation:exit_radius              kind         operation:exit_sweep      N@      kind         operation:exit_distance      �?      kind         operation:leadOutRadius              kind         operation:pierceClearance�������?      kind         operation:tool_cutHeight      �?      kind         operation:tool_cutPower      T@      kind         operation:tool_pierceHeight      @      kind         operation:tool_pierceTime      �?      kind         operation:tool_piercePower      T@
      operation:tool_assistGas   on      kind         operation:tool_pressure      �?      kind         operation:tool_abrasiveFlowRate      �?
   '   operation_post_property:op0100LayerMode   inherit
   $   operation_post_property:op0200UseAir   gas
   )   operation_post_property:op0300LaserEnable   laser2      kind      (   operation_post_property:op0400PowerScale      Y@      kind      %   operation_post_property:op0500ZOffset              kind      $   operation_post_property:op0600Passes      �?      kind      #   operation_post_property:op0700ZStep        
   '   operation_post_property:op0800GroupName    
   1   operation_post_property:op0900CustomCutSettingXML    
              ��  ��  �?  �?              �?              �?  ��  ��  �?  �?              �?              �?             �                                                              �������?�������?      �?      @              �?      �?              T@      T@   o n    m a n u a l    1                                                                                                                                                        pΘ@�@��Ao�?��A    33KA\�"@33KA    33�A$�A  �A33�A  �A   X   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-description   A c r y l i c   -   C O 2   g l a s s    T   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-comment       S   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-vendor       W   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-product-id       _   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-description       [   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-comment       Z   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-vendor       ^   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-product-id          movement:lead_in      �@      movement:cutting      �@      movement:lead_out      �@      movement:transition      �@      movement:direct      �@      movement:helix_ramp      �@      movement:profile_ramp      �@      movement:zigzag_ramp      �@      movement:ramp      �@      movement:plunge              movement:predrill      �@      movement:extended      �@      movement:reduced      �@      movement:finish_cutting      �@      movement:high_feed              movement:depositing                       e   ӝ�BM��B  pA    e   ӝ�BM��B        �      
      action   pierced   ��B��B      �D   d   f��B��B      �D  d   f��Bf��B      �D   d   ��Bf��B      �D   d   ��B��B      �D   d   ��B��B      �D  d   ӝ�BM��B      �D   �      e   ӝ�BM��B  pA          1   http://www.cimco-software.com/namespace/nc/marker       :   http://www.cimco-software.com/namespace/nc/parameter/notes    
   G   http://www.cimco-software.com/namespace/nc/parameter/operation-strategy   jet2d   F   http://www.cimco-software.com/namespace/nc/parameter/operation-comment   T o p   h e x   e t c h       autodeskcam:operation-id         leads-supported         autodeskcam:path   S e t u p s \ S e t u p 1 \ T o p   h e x   e t c h       operation:is2DStrategy         operation:is3DStrategy          operation:isRoughingStrategy          operation:isFinishingStrategy         operation:isMillingStrategy          operation:isTurningStrategy          operation:isJetStrategy         operation:isAdditiveStrategy          operation:isProbingStrategy          operation:isInspectionStrategy          operation:isDrillingStrategy          operation:isHoleMillingStrategy          operation:isThreadStrategy          operation:isSamplingStrategy          operation:isRotaryStrategy       $   operation:isSecondarySpindleStrategy          operation:isSurfaceStrategy           operation:isCheckSurfaceStrategy          operation:isMultiAxisStrategy          operation:advancedMode          operation:betaMode          operation:alphaMode          operation:isXpress          operation:licenseMultiaxis         operation:license3D         operation:metric         operation:isAssemblyDocument   
      operation:context	   operation
      operation:strategy   jet2d
      operation:operation_description    
      operation:tool_type   laser cutter      operation:tool_isTurning          operation:tool_isMill          operation:tool_isDrill          operation:tool_isJet         operation:tool_isDepositing    
      operation:tool_unit   millimeters      operation:tool_number         operation:tool_diameterOffset   
      operation:tool_description   Acrylic - CO2 glass
      operation:tool_comment    
      operation:tool_vendor    
      operation:tool_productId          kind         operation:tool_segmentHeight      $@      kind      #   operation:tool_segmentDiameterLower      $@      kind      #   operation:tool_segmentDiameterUpper      $@      kind      !   operation:tool_shaftSegmentHeight      �?      kind      (   operation:tool_shaftSegmentDiameterLower      �?      kind      (   operation:tool_shaftSegmentDiameterUpper      �?      kind         operation:tool_kerfWidth�������?      kind         operation:tool_nozzleDiameter�������?      kind         operation:tool_headClearance      �?
   $   operation:tool_machineQualityControl   manual      operation:holder_attached    
      operation:holder_description    
      operation:holder_comment    
      operation:holder_vendor    
      operation:holder_productId    
      operation:holder_productLink    
      operation:holder_libraryName    
      operation:tool_productLink    
      operation:cuttingMode   etch      kind         operation:kerfWidth�������?
      operation:machineQualityControl   manual      kind         operation:tool_feedCutting      �@      kind         operation:tool_feedEntry      �@      kind         operation:tool_feedExit      �@
      operation:featureOperationId   none      kind         operation:surfaceZHigh      �      kind         operation:surfaceZLow      �      kind         operation:surfaceXLow      �?      kind         operation:surfaceXHigh      i@      kind         operation:surfaceYLow      �?      kind         operation:surfaceYHigh      i@      kind         operation:stockZHigh              kind         operation:stockZLow      �      kind         operation:stockXLow              kind         operation:stockXHigh     @i@      kind         operation:stockYLow              kind         operation:stockYHigh     @i@      operation:selectCoPlanarFaces    
      operation:contours_loops   all
      operation:contours_side   start-outside      kind         operation:tabWidth      @
      operation:tabPositioning   distance
      operation:tabApproach   contour      operation:tabsPerContour         kind         operation:tabDistance      I@
      operation:clearanceHeight_mode   from retract height      kind          operation:clearanceHeight_offset      $@      kind         operation:clearanceHeight_value      .@   "   operation:clearanceHeight_absolute   
      operation:retractHeight_mode   from stock top      kind         operation:retractHeight_offset      @      kind         operation:retractHeight_value      @       operation:retractHeight_absolute   
      operation:topHeight_mode   from stock top      kind         operation:topHeight_offset              kind         operation:topHeight_value              operation:topHeight_absolute         kind         operation:tolerance{�G�z�?      kind         operation:contourTolerance{�G�zt?      kind         operation:calculationTolerance{�G�z�?      kind         operation:chainingTolerance{�G�z�?      kind         operation:gougingTolerance{�G�z�?
      operation:compensation   center
      operation:compensationType   computer      kind         operation:finishingOverlap        
      operation:cornerMode   roll      operation:preserveOrder          operation:bothWaysJL         kind         operation:stockToLeave              kind      "   operation:smoothingFilterTolerance              kind         operation:reducedFeedChange      9@      kind         operation:reducedFeedRadius              kind         operation:reducedFeedDistance              kind         operation:reducedFeedrate      |@       operation:reduceOnlyInnerCorners          operation:keepToolDown          kind         operation:stayDownDistance              kind      "   operation:minimumStayDownClearance              kind      $   operation:minimumStayDownClearanceJl           "   operation:forceRetractForInsideCut          kind         operation:noEngagementFeedrate      �@      operation:doLeadIn    
      operation:entry_style   smooth      kind         operation:entry_radius              kind         operation:entry_sweep              kind         operation:entry_distance              kind         operation:leadInRadius              operation:doLeadOut          operation:exit_sameAsEntry    
      operation:exit_style   smooth      kind         operation:exit_radius              kind         operation:exit_sweep              kind         operation:exit_distance              kind         operation:leadOutRadius              kind         operation:pierceClearance              kind         operation:tool_cutHeight      �?      kind         operation:tool_cutPower      T@      kind         operation:tool_pierceHeight      @      kind         operation:tool_pierceTime      �?      kind         operation:tool_piercePower      T@
      operation:tool_assistGas   on      kind         operation:tool_pressure      �?      kind         operation:tool_abrasiveFlowRate      �?
              ��  ��  �?  �?              �?              �?  ��  ��  �?  �?              �?              �?             �                                                             �������?�������?      �?      @              �?      �?              T@      T@   o n    m a n u a l    1                                                                                                                                                        pΘ@�@��Ao�?��A    33KA\�"@33KA    33�A$�A  �A33�A  �A   X   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-description   A c r y l i c   -   C O 2   g l a s s    T   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-comment       S   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-vendor       W   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-product-id       _   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-description       [   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-comment       Z   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-vendor       ^   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-product-id          movement:lead_in      �@      movement:cutting      �@      movement:lead_out      �@      movement:transition      �@      movement:direct      �@      movement:helix_ramp      �@      movement:profile_ramp      �@      movement:zigzag_ramp      �@      movement:ramp      �@      movement:plunge              movement:predrill      �@      movement:extended      �@      movement:reduced      �@      movement:finish_cutting      �@      movement:high_feed              movement:depositing                       e   ��B C  pA    e   ��B C        �      d   �Q�B  !C      �D  d   �Q�B  +C      �D   d     �B  0C      �D   d   ���B  +C      �D   d   ���B  !C      �D   d     �B  C      �D   d   ��B C      �D  �      e   ��B C  pA          1   http://www.cimco-software.com/namespace/nc/marker       :   http://www.cimco-software.com/namespace/nc/parameter/notes    
   G   http://www.cimco-software.com/namespace/nc/parameter/operation-strategy   jet2d   F   http://www.cimco-software.com/namespace/nc/parameter/operation-comment   B o t t o m   r o u n d e d   v a p o r i z e       autodeskcam:operation-id         leads-supported         autodeskcam:path%   S e t u p s \ S e t u p 1 \ B o t t o m   r o u n d e d   v a p o r i z e       operation:is2DStrategy         operation:is3DStrategy          operation:isRoughingStrategy          operation:isFinishingStrategy         operation:isMillingStrategy          operation:isTurningStrategy          operation:isJetStrategy         operation:isAdditiveStrategy          operation:isProbingStrategy          operation:isInspectionStrategy          operation:isDrillingStrategy          operation:isHoleMillingStrategy          operation:isThreadStrategy          operation:isSamplingStrategy          operation:isRotaryStrategy       $   operation:isSecondarySpindleStrategy          operation:isSurfaceStrategy           operation:isCheckSurfaceStrategy          operation:isMultiAxisStrategy          operation:advancedMode          operation:betaMode          operation:alphaMode          operation:isXpress          operation:licenseMultiaxis         operation:license3D         operation:metric         operation:isAssemblyDocument   
      operation:context	   operation
      operation:strategy   jet2d
      operation:operation_description    
      operation:tool_type   laser cutter      operation:tool_isTurning          operation:tool_isMill          operation:tool_isDrill          operation:tool_isJet         operation:tool_isDepositing    
      operation:tool_unit   millimeters      operation:tool_number         operation:tool_diameterOffset   
      operation:tool_description   Acrylic - CO2 glass
      operation:tool_comment    
      operation:tool_vendor    
      operation:tool_productId          kind         operation:tool_segmentHeight      $@      kind      #   operation:tool_segmentDiameterLower      $@      kind      #   operation:tool_segmentDiameterUpper      $@      kind      !   operation:tool_shaftSegmentHeight      �?      kind      (   operation:tool_shaftSegmentDiameterLower      �?      kind      (   operation:tool_shaftSegmentDiameterUpper      �?      kind         operation:tool_kerfWidth�������?      kind         operation:tool_nozzleDiameter�������?      kind         operation:tool_headClearance      �?
   $   operation:tool_machineQualityControl   manual      operation:holder_attached    
      operation:holder_description    
      operation:holder_comment    
      operation:holder_vendor    
      operation:holder_productId    
      operation:holder_productLink    
      operation:holder_libraryName    
      operation:tool_productLink    
      operation:cuttingMode   vaporize      kind         operation:kerfWidth�������?
      operation:machineQualityControl   manual      kind         operation:tool_feedCutting      �@      kind         operation:tool_feedEntry      �@      kind         operation:tool_feedExit      �@
      operation:featureOperationId   none      kind         operation:surfaceZHigh      �      kind         operation:surfaceZLow      �      kind         operation:surfaceXLow      �?      kind         operation:surfaceXHigh      i@      kind         operation:surfaceYLow      �?      kind         operation:surfaceYHigh      i@      kind         operation:stockZHigh              kind         operation:stockZLow      �      kind         operation:stockXLow              kind         operation:stockXHigh     @i@      kind         operation:stockYLow              kind         operation:stockYHigh     @i@      operation:selectCoPlanarFaces    
      operation:contours_loops   all
      operation:contours_side   start-outside      kind         operation:tabWidth      @
      operation:tabPositioning   distance
      operation:tabApproach   contour      operation:tabsPerContour         kind         operation:tabDistance      I@
      operation:clearanceHeight_mode   from retract height      kind          operation:clearanceHeight_offset      $@      kind         operation:clearanceHeight_value      .@   "   operation:clearanceHeight_absolute   
      operation:retractHeight_mode   from stock top      kind         operation:retractHeight_offset      @      kind         operation:retractHeight_value      @       operation:retractHeight_absolute   
      operation:topHeight_mode   from stock top      kind         operation:topHeight_offset              kind         operation:topHeight_value              operation:topHeight_absolute         kind         operation:tolerance{�G�z�?      kind         operation:contourTolerance{�G�zt?      kind         operation:calculationTolerance{�G�z�?      kind         operation:chainingTolerance{�G�z�?      kind         operation:gougingTolerance{�G�z�?
      operation:compensation   left
      operation:compensationType   computer      kind         operation:finishingOverlap        
      operation:cornerMode   roll      operation:preserveOrder          operation:bothWaysJL         kind         operation:stockToLeave              kind      "   operation:smoothingFilterTolerance              kind         operation:reducedFeedChange      9@      kind         operation:reducedFeedRadius              kind         operation:reducedFeedDistance              kind         operation:reducedFeedrate      |@       operation:reduceOnlyInnerCorners          operation:keepToolDown          kind         operation:stayDownDistance              kind      "   operation:minimumStayDownClearance              kind      $   operation:minimumStayDownClearanceJl           "   operation:forceRetractForInsideCut          kind         operation:noEngagementFeedrate      �@      operation:doLeadIn   
      operation:entry_style   smooth      kind         operation:entry_radius              kind         operation:entry_sweep      N@      kind         operation:entry_distance      �?      kind         operation:leadInRadius              operation:doLeadOut         operation:exit_sameAsEntry   
      operation:exit_style   smooth      kind         operation:exit_radius              kind         operation:exit_sweep      N@      kind         operation:exit_distance      �?      kind         operation:leadOutRadius              kind         operation:pierceClearance              kind         operation:tool_cutHeight      �?      kind         operation:tool_cutPower      T@      kind         operation:tool_pierceHeight      @      kind         operation:tool_pierceTime      �?      kind         operation:tool_piercePower      T@
      operation:tool_assistGas   on      kind         operation:tool_pressure      �?      kind         operation:tool_abrasiveFlowRate      �?
              ��  ��  �?  �?              �?              �?  ��  ��  �?  �?              �?              �?             �                                                             �������?�������?      �?      @              �?      �?              T@      T@   o n    m a n u a l    1                                                                                                                                                        pΘ@�@��Ao�?��A    33KA\�"@33KA    33�A$�A  �A33�A  �A   X   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-description   A c r y l i c   -   C O 2   g l a s s    T   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-comment       S   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-vendor       W   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-product-id       _   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-description       [   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-comment       Z   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-vendor       ^   http://www.cimco-software.com/namespace/nc/format/compact-nci/parameter/tool-holder-product-id          movement:lead_in      �@      movement:cutting      �@      movement:lead_out      �@      movement:transition      �@      movement:direct      �@      movement:helix_ramp      �@      movement:profile_ramp      �@      movement:zigzag_ramp      �@      movement:ramp      �@      movement:plunge              movement:predrill      �@      movement:extended      �@      movement:reduced      �@      movement:finish_cutting      �@      movement:high_feed              movement:depositing                       e   Y�CLgpB  pA    e   Y�CLgpB        d   3�CLgqB      �D   �      d   3�CffsB      �D  d   3�C��sB      �D   d     tB��sB      �D   n   33LB  LB      tB  LB              �?  �D   d   33LBff�A      �D   d     Cff�A      �D   n   3�C  $B      C  $B              �?  �D   d   3�CLgqB      �D  �      d   Y�CLgrB      �D   e   Y�CLgrB  pA       