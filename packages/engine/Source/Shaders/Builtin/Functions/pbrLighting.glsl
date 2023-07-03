vec3 lambertianDiffuse(vec3 diffuseColor)
{
    return diffuseColor / czm_pi;
}

vec3 fresnelSchlick2(vec3 f0, vec3 f90, float VdotH)
{
    return f0 + (f90 - f0) * pow(clamp(1.0 - VdotH, 0.0, 1.0), 5.0);
}

float smithVisibilityG1(float NdotV, float roughness)
{
    // this is the k value for direct lighting.
    // for image based lighting it will be roughness^2 / 2
    float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float smithVisibilityGGX(float roughness, float NdotL, float NdotV)
{
    return (
        smithVisibilityG1(NdotL, roughness) *
        smithVisibilityG1(NdotV, roughness)
    );
}

float GGX(float roughness, float NdotH)
{
    float roughnessSquared = roughness * roughness;
    float f = (NdotH * roughnessSquared - NdotH) * NdotH + 1.0;
    return roughnessSquared / (czm_pi * f * f);
}

/**
 * Compute the diffuse and specular contributions using physically based
 * rendering. This function only handles direct lighting.
 * <p>
 * This function only handles the lighting calculations. Metallic/roughness
 * and specular/glossy must be handled separately. See {@czm_pbrMetallicRoughnessMaterial}, {@czm_pbrSpecularGlossinessMaterial} and {@czm_defaultPbrMaterial}
 * </p>
 *
 * @name czm_pbrlighting
 * @glslFunction
 *
 * @param {vec3} positionEC The position of the fragment in eye coordinates
 * @param {vec3} normalEC The surface normal in eye coordinates
 * @param {vec3} lightDirectionEC Unit vector pointing to the light source in eye coordinates.
 * @param {vec3} lightColorHdr radiance of the light source. This is a HDR value.
 * @param {czm_pbrParameters} The computed PBR parameters.
 * @return {vec3} The computed HDR color
 *
 * @example
 * czm_pbrParameters pbrParameters = czm_pbrMetallicRoughnessMaterial(
 *  baseColor,
 *  metallic,
 *  roughness
 * );
 * vec3 color = czm_pbrlighting(
 *  positionEC,
 *  normalEC,
 *  lightDirectionEC,
 *  lightColorHdr,
 *  pbrParameters);
 */
vec3 czm_pbrLighting(
    vec3 positionEC,
    vec3 normalEC,
    vec3 lightDirectionEC,
    vec3 lightColorHdr,
    czm_pbrParameters pbrParameters
)
{
   #ifdef USE_VCS_CUSTOM_SHADING
	    lightColorHdr *= 0.5;
	
	    vec3 diffuseColor = pbrParameters.diffuseColor;
	    float u_lambertDiffuseMultiplier = 0.9;
		float u_vertexShadowDarkness = 0.3;
		
		float ambientLuminanceNight = 0.05;
		float ambientLuminanceDay = (1.0 - ambientLuminanceNight) * u_vertexShadowDarkness + ambientLuminanceNight;
		
	 	float distance = length(positionEC);
	    vec3 v = -normalize(positionEC);
	    vec3 l = normalize(lightDirectionEC);
	    vec3 h = normalize(v + l);
	    vec3 n = normalEC;
	    float NdotL = dot(n, l);
	    float NdotLclamped = clamp(NdotL, 0.0001, 1.0);
	    float NdotV = abs(dot(n, v)) + 0.001;
	    float NdotH = clamp(dot(n, h), 0.0, 1.0);
	    float VdotH = clamp(dot(v, h), 0.0, 1.0);
	    
	    vec3 positionWC = vec3(czm_inverseView * vec4(positionEC, 1.0));
	    vec3 upWC = normalize(positionWC);
	    vec3 lWC = normalize(czm_inverseViewRotation * l);
	    vec3 nWC = normalize(czm_inverseViewRotation * n);
	    float LdotZ = dot(lWC, -upWC);
	    float NdotZ = dot(nWC, upWC);
	    float sunAboveHorizon = clamp(-200.0 * LdotZ, 0.0, 1.0);
		
	    // beginning of nautical twilight at 12 degrees below horizon (in radiens)
	    float LdotZclamped = clamp(LdotZ, 0.0, 1.0);
	    float m = 0.209439510239;
	    float nn = (-LdotZclamped + m) / m;
	    float beta = smoothstep(0.0, 1.0, nn);
	    float ambientLightLuminance = mix(ambientLuminanceNight, ambientLuminanceDay, beta);
	    
		//modify hue of sunlight
		vec3 directLightColorHdr = lightColorHdr;
	    float gamma = clamp(-20.0 * LdotZ, 0.0, 1.0);
	    
	    float sun_minB =  0.5; //0.7;
	    float sun_minG = sun_minB * 0.5 + 0.5; 
	    float sun_G = gamma*(1.0 - sun_minG) + sun_minG;
	    float sun_B = gamma*(1.0 - sun_minB) + sun_minB;
	    directLightColorHdr.g *= sun_G;
	    directLightColorHdr.b *= sun_B;
		
	    //ambient diffuse light
	    float ambientModulationMinimum = 0.2;
	    float ambientModulation = ambientModulationMinimum + (NdotZ*0.5 + 0.5)*(NdotL*0.2 + 0.8)*(1.0 - ambientModulationMinimum);
	    vec3 ambientLightContribution = diffuseColor * lightColorHdr * ambientLightLuminance * ambientModulation;
	    
		// direct light
	    vec3 directLightContribution = diffuseColor * directLightColorHdr * NdotLclamped * u_lambertDiffuseMultiplier * sunAboveHorizon;
	    
	    //direct specular light
	    vec3 f0 = pbrParameters.f0;
	    float reflectance = max(max(f0.r, f0.g), f0.b);
	    vec3 f90 = vec3(clamp(reflectance * 25.0, 0.0, 1.0));
	    vec3 F = fresnelSchlick2(f0, f90, VdotH);
	    float alpha = pbrParameters.roughness;
	    float G = smithVisibilityGGX(alpha, NdotLclamped, NdotV);
	    float D = GGX(alpha, NdotH);
	    vec3 directSpecularContribution = clamp(F * G * D / (4.0 * NdotLclamped * NdotV) * sunAboveHorizon * directLightColorHdr, 0.0, 1.0);
	    
	    vec3 finalColorRGB = ambientLightContribution + directLightContribution + directSpecularContribution;
	    
	    return finalColorRGB;
	#else
    vec3 v = -normalize(positionEC);
    vec3 l = normalize(lightDirectionEC);
    vec3 h = normalize(v + l);
    vec3 n = normalEC;
    float NdotL = clamp(dot(n, l), 0.001, 1.0);
    float NdotV = abs(dot(n, v)) + 0.001;
    float NdotH = clamp(dot(n, h), 0.0, 1.0);
    float LdotH = clamp(dot(l, h), 0.0, 1.0);
    float VdotH = clamp(dot(v, h), 0.0, 1.0);

    vec3 f0 = pbrParameters.f0;
    float reflectance = max(max(f0.r, f0.g), f0.b);
    vec3 f90 = vec3(clamp(reflectance * 25.0, 0.0, 1.0));
    vec3 F = fresnelSchlick2(f0, f90, VdotH);

    float alpha = pbrParameters.roughness;
    float G = smithVisibilityGGX(alpha, NdotL, NdotV);
    float D = GGX(alpha, NdotH);
    vec3 specularContribution = F * G * D / (4.0 * NdotL * NdotV);

    vec3 diffuseColor = pbrParameters.diffuseColor;
    // F here represents the specular contribution
    vec3 diffuseContribution = (1.0 - F) * lambertianDiffuse(diffuseColor);

    // Lo = (diffuse + specular) * Li * NdotL
    return (diffuseContribution + specularContribution) * NdotL * lightColorHdr;
	#endif    
}
